create table if not exists public.appointment_bookings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  age smallint check (age is null or age between 1 and 120),
  address text,
  appointment_reason text,
  service_type text not null
    check (service_type in ('Clinic Consultation', 'Home Physiotherapy', 'Online Consultation')),
  appointment_date date not null,
  appointment_time text not null,
  amount_paise bigint not null check (amount_paise >= 100),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  patient_uuid uuid references public.patients(id) on delete set null,
  patient_id text,
  appointment_id text unique,
  pin_issued boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists appointment_bookings_created_idx
  on public.appointment_bookings (created_at desc);

create index if not exists appointment_bookings_phone_idx
  on public.appointment_bookings (phone);

alter table public.appointment_bookings enable row level security;

revoke all on table public.appointment_bookings from anon, authenticated;
grant all on table public.appointment_bookings to service_role;

create or replace function public.finalize_appointment_booking(
  p_booking_id uuid,
  p_payment_id text,
  p_pin_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.appointment_bookings%rowtype;
  v_patient public.patients%rowtype;
  v_pin_issued boolean := false;
  v_appointment_id text;
  v_patient_id text;
begin
  select *
  into v_booking
  from public.appointment_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Appointment booking not found' using errcode = 'P0002';
  end if;

  if v_booking.payment_status = 'paid' then
    if v_booking.razorpay_payment_id <> p_payment_id then
      raise exception 'Booking was paid with a different payment' using errcode = '23505';
    end if;

    if v_booking.pin_issued then
      update public.patient_credentials
      set pin_hash = p_pin_hash,
          failed_attempts = 0,
          locked_until = null
      where patient_id = v_booking.patient_uuid;

      if not found then
        raise exception 'Patient credential record not found' using errcode = 'P0002';
      end if;
    end if;

    return pg_catalog.jsonb_build_object(
      'patient_uuid', v_booking.patient_uuid,
      'patient_id', v_booking.patient_id,
      'appointment_id', v_booking.appointment_id,
      'pin_issued', v_booking.pin_issued
    );
  end if;

  if v_booking.payment_status <> 'pending' or v_booking.razorpay_order_id is null then
    raise exception 'Booking is not awaiting payment' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.phone, 0)
  );

  select *
  into v_patient
  from public.patients
  where phone = v_booking.phone
  limit 1
  for update;

  if found then
    v_patient_id := v_patient.patient_id;

    if not exists (
      select 1
      from public.patient_credentials
      where patient_id = v_patient.id
    ) then
      insert into public.patient_credentials (patient_id, pin_hash)
      values (v_patient.id, p_pin_hash);
      v_pin_issued := true;
    end if;
  else
    v_patient_id := 'VY' ||
      pg_catalog.upper(
        pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
          1,
          8
        )
      );

    insert into public.patients (
      patient_id,
      full_name,
      phone,
      email,
      address
    )
    values (
      v_patient_id,
      v_booking.full_name,
      v_booking.phone,
      v_booking.email,
      v_booking.address
    )
    returning * into v_patient;

    insert into public.patient_credentials (patient_id, pin_hash)
    values (v_patient.id, p_pin_hash);
    v_pin_issued := true;
  end if;

  v_appointment_id := 'APT' ||
    pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        8
      )
    );

  insert into public.appointments (
    appointment_id,
    patient_id,
    appointment_date,
    appointment_time,
    service_type,
    status,
    amount,
    payment_status
  )
  values (
    v_appointment_id,
    v_patient.id,
    v_booking.appointment_date,
    v_booking.appointment_time,
    v_booking.service_type,
    'confirmed',
    v_booking.amount_paise::numeric / 100,
    'paid'
  );

  update public.appointment_bookings
  set patient_uuid = v_patient.id,
      patient_id = v_patient_id,
      appointment_id = v_appointment_id,
      razorpay_payment_id = p_payment_id,
      payment_status = 'paid',
      pin_issued = v_pin_issued,
      paid_at = pg_catalog.now()
  where id = v_booking.id;

  return pg_catalog.jsonb_build_object(
    'patient_uuid', v_patient.id,
    'patient_id', v_patient_id,
    'appointment_id', v_appointment_id,
    'pin_issued', v_pin_issued
  );
end;
$$;

revoke all on function public.finalize_appointment_booking(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_appointment_booking(uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
