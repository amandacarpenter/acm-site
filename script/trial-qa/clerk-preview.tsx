// Explicitly mocked identity for browser QA/private design review only.
// This module is aliased ONLY by trial-qa/vite.config.ts, never the production build.
import { createContext, useContext, useState, type ReactNode } from "react";
const Auth = createContext<any>(null);
export function ClerkProvider({children}:{children:ReactNode}) {
  const initial = new URLSearchParams(location.search).get("qaUser");
  const [signed,setSigned] = useState(Boolean(initial));
  const user = { id:"preview-user", publicMetadata: initial==="paid" ? {subscribed:true,plan:"individual"} : {}, firstName:"Preview",
    primaryEmailAddress:{emailAddress:"preview@example.invalid"},reload:async()=>{} };
  return <Auth.Provider value={{signed,setSigned,user}}>{children}</Auth.Provider>;
}
export function useAuth() { const a=useContext(Auth); return {isLoaded:true,isSignedIn:a.signed,userId:a.signed?a.user.id:null,getToken:async()=>"preview-only"}; }
export function useUser() { const a=useContext(Auth); return {isLoaded:true,isSignedIn:a.signed,user:a.signed?a.user:null}; }
export function SignedIn({children}:{children:ReactNode}) {return useAuth().isSignedIn?<>{children}</>:null;}
export function SignedOut({children}:{children:ReactNode}) {return !useAuth().isSignedIn?<>{children}</>:null;}
export function UserButton() {const a=useContext(Auth);return <button aria-label="Sign out of preview" className="rounded-full bg-gray-200 text-gray-800 h-9 w-9 text-sm" onClick={()=>a.setSigned(false)}>P</button>;}
export function SignUp() {const a=useContext(Auth);return <div className="bg-white border p-8 rounded-xl max-w-sm"><h2 className="text-xl font-bold mb-3">Preview account</h2><p className="mb-5">This is a design preview. No account is created and no email is collected.</p><button className="bg-[#0f766e] text-white rounded-lg px-5 py-3" onClick={()=>a.setSigned(true)}>Continue with sample account</button></div>;}
export const SignIn=SignUp;
export function RedirectToSignIn() {return <p className="p-8">Sign in using the preview account to see this page.</p>;}
export function useClerk() {return {openUserProfile:()=>{document.querySelector('[role="note"]')!.textContent="Preview only. Email verification uses Clerk on the live site; this preview does not send email.";}};}
export function useOrganization() {return {isLoaded:true,organization:null};}
export function useOrganizationList() {return {isLoaded:true,userMemberships:{data:[]}};}
export function OrganizationProfile() {return <p>Organization settings are not available in this preview.</p>;}
