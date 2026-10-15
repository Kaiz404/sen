import { Redirect } from 'expo-router';

/** Unknown links go home, and the guard sends home on to Lock while locked. Never the default sitemap. */
export default function NotFound() {
  return <Redirect href="/" />;
}
