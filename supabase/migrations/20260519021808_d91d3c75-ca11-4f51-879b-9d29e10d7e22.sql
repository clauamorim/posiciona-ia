CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, profession, niche, whatsapp, main_goal, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'profession',
    NEW.raw_user_meta_data->>'niche',
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'main_goal',
    NEW.raw_user_meta_data->>'gender'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 1);
  INSERT INTO public.user_balances (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$function$;