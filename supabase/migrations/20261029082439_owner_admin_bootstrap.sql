CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS private.owner_bootstrap(email text PRIMARY KEY,claimed_by uuid UNIQUE);
REVOKE ALL ON private.owner_bootstrap FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.bootstrap_verified_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF NEW.email_confirmed_at IS NOT NULL AND coalesce(NEW.is_anonymous,false)=false THEN
   PERFORM 1 FROM private.owner_bootstrap WHERE email=lower(NEW.email) AND claimed_by IS NULL FOR UPDATE;
   IF FOUND THEN
     INSERT INTO public.admin_roles(user_id,email,role_name,is_active)
     VALUES(NEW.id,NEW.email,'super_admin',true) ON CONFLICT(user_id) DO NOTHING;
     UPDATE private.owner_bootstrap SET claimed_by=NEW.id WHERE email=lower(NEW.email) AND claimed_by IS NULL;
   END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.bootstrap_verified_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bootstrap_verified_owner AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION private.bootstrap_verified_owner();
