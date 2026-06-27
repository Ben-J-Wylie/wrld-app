// Standalone appeal route. Top-level (sibling of (app)) so the suspension banner
// and ban gate — which live inside the (app) layout — don't render over it.
// Reached from those in-session, or via the emailed deep link wrld://appeal?t=….
export { AppealScreen as default } from '@/components/screens/AppealScreen'
