-- 006_update_trigger_defaults.sql
-- Update handle_new_user to seed default car types, price tiers, and pax settings.
-- Also fixes any existing users who are missing their driver / org / membership records.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organisations (name, min_pax, max_pax)
  VALUES (COALESCE(NEW.email, 'My Organisation'), 1, 6)
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, v_org_id, 'owner');

  INSERT INTO public.drivers (org_id, user_id, name, registered_at)
  VALUES (v_org_id, NEW.id, COALESCE(NEW.email, 'Admin'), NOW());

  -- Default car types
  INSERT INTO public.car_types (org_id, name, max_capacity) VALUES
    (v_org_id, 'Standard Car', 2),
    (v_org_id, 'Van Car',      6),
    (v_org_id, 'Bus',         15);

  -- Default price tiers (EUR)
  INSERT INTO public.price_tiers (org_id, min_pax, max_pax, price) VALUES
    (v_org_id, 1,  2,  50),
    (v_org_id, 3,  6,  70),
    (v_org_id, 7, 15, 250);

  RETURN NEW;
END;
$$;

-- Make sure the trigger is attached (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ----------------------------------------------------------------
-- One-time fix: backfill any users missing their setup records
-- (e.g. gul.aul@gmail.com whose trigger never fired)
-- ----------------------------------------------------------------
DO $$
DECLARE
  r       RECORD;
  v_org_id uuid;
BEGIN
  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.drivers d WHERE d.user_id = u.id
    )
  LOOP
    INSERT INTO public.organisations (name, min_pax, max_pax)
    VALUES (COALESCE(r.email, 'My Organisation'), 1, 6)
    RETURNING id INTO v_org_id;

    INSERT INTO public.memberships (user_id, org_id, role)
    VALUES (r.id, v_org_id, 'owner');

    INSERT INTO public.drivers (org_id, user_id, name, registered_at)
    VALUES (v_org_id, r.id, COALESCE(r.email, 'Admin'), NOW());

    INSERT INTO public.car_types (org_id, name, max_capacity) VALUES
      (v_org_id, 'Standard Car', 2),
      (v_org_id, 'Van Car',      6),
      (v_org_id, 'Bus',         15);

    INSERT INTO public.price_tiers (org_id, min_pax, max_pax, price) VALUES
      (v_org_id, 1,  2,  50),
      (v_org_id, 3,  6,  70),
      (v_org_id, 7, 15, 250);
  END LOOP;
END $$;
