
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  profession TEXT,
  niche TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Business questionnaires
CREATE TABLE public.business_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  company_name TEXT,
  services TEXT,
  target_audience TEXT,
  external_problems TEXT,
  internal_problems TEXT,
  empathic_statements TEXT,
  authority_proofs TEXT,
  hiring_steps TEXT,
  client_fears TEXT,
  main_cta TEXT,
  negative_consequences TEXT,
  promised_transformations TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version)
);
ALTER TABLE public.business_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bq" ON public.business_questionnaires
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bq" ON public.business_questionnaires
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own bq" ON public.business_questionnaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bq" ON public.business_questionnaires
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete bq" ON public.business_questionnaires
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bq_updated_at
  BEFORE UPDATE ON public.business_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Archetype questions (static reference)
CREATE TABLE public.archetype_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_number INT NOT NULL UNIQUE,
  statement TEXT NOT NULL,
  archetype_name TEXT NOT NULL
);
ALTER TABLE public.archetype_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read questions" ON public.archetype_questions
  FOR SELECT TO authenticated USING (true);

-- Archetype answers
CREATE TABLE public.archetype_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  question_id UUID REFERENCES public.archetype_questions(id) NOT NULL,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version, question_id)
);
ALTER TABLE public.archetype_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers" ON public.archetype_answers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all answers" ON public.archetype_answers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own answers" ON public.archetype_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.archetype_answers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete answers" ON public.archetype_answers
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_answers_updated_at
  BEFORE UPDATE ON public.archetype_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Archetype scores (calculated)
CREATE TABLE public.archetype_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  archetype_name TEXT NOT NULL,
  total_score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version, archetype_name)
);
ALTER TABLE public.archetype_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scores" ON public.archetype_scores
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all scores" ON public.archetype_scores
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own scores" ON public.archetype_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scores" ON public.archetype_scores
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete scores" ON public.archetype_scores
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User top archetypes
CREATE TABLE public.user_top_archetypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  archetype_name TEXT NOT NULL,
  rank INT NOT NULL CHECK (rank >= 1 AND rank <= 3),
  score INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version, rank)
);
ALTER TABLE public.user_top_archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own top" ON public.user_top_archetypes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all top" ON public.user_top_archetypes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own top" ON public.user_top_archetypes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own top" ON public.user_top_archetypes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete top" ON public.user_top_archetypes
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  content JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete reports" ON public.reports
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
