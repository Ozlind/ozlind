const supabase = await createClient();
const { data: { user }, error: authError } =
  await supabase.auth.getUser();

if (authError || !user) {
  return json({ error: "Authentication required." }, 401);
}