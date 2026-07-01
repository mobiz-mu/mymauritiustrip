import type { ActionState } from '../actions';
import LoginForm from './form';

// Server wrapper: translate auth redirect params into a clear notice shown above
// the form (e.g. failed email confirmation, successful password reset).
function noticeFor(sp: { error?: string; reset?: string }): ActionState {
  if (sp.reset === '1') return { success: 'Your password was updated. Please log in.' };
  switch (sp.error) {
    case 'verification_failed':
      return { error: 'We couldn’t verify your email link — it may have expired. Try logging in, or request a new confirmation email.' };
    case 'auth_callback_failed':
      return { error: 'That sign-in link could not be verified. Please try again.' };
    case 'email_not_confirmed':
      return { error: 'Please confirm your email first — check your inbox for the confirmation link.' };
    default:
      return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  return <LoginForm notice={noticeFor(sp)} />;
}
