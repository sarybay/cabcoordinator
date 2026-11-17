-- 007_fix_driver_trigger.sql
-- When a new auth user is created for an email that already has a pending driver
-- invite, link them to the existing driver record instead of creating a new org.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id  uuid;
  v_driver  RECORD;
BEGIN
  -- Check for a pending driver invite for this email
  SELECT d.id, d.org_id INTO v_driver
  FROM public.drivers d
  WHERE lower(d.email) = lower(NEW.email)
    AND d.user_id IS NULL
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_driver.id IS NOT NULL THEN
    -- Link the new auth user to the existing driver record
    UPDATE public.drivers SET user_id = NEW.id WHERE id = v_driver.id;

    -- Add them as a member of the org they were invited to
    INSERT INTO public.memberships (user_id, org_id, role)
    VALUES (NEW.id, v_driver.org_id, 'member')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
  END IF;

  -- No invite found → create a fresh org for this user (owner signup)
  INSERT INTO public.organisations (name, min_pax, max_pax)
  VALUES (COALESCE(NEW.email, 'My Organisation'), 1, 6)
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, v_org_id, 'owner');

  INSERT INTO public.drivers (org_id, user_id, name, registered_at)
  VALUES (v_org_id, NEW.id, COALESCE(NEW.email, 'Admin'), NOW());

  INSERT INTO public.car_types (org_id, name, max_capacity) VALUES
    (v_org_id, 'Standard Car', 2),
    (v_org_id, 'Van Car',      6),
    (v_org_id, 'Bus',         15);

  INSERT INTO public.price_tiers (org_id, min_pax, max_pax, price) VALUES
    (v_org_id, 1,  2,  50),
    (v_org_id, 3,  6,  70),
    (v_org_id, 7, 15, 250);

  RETURN NEW;
END;
$$;
