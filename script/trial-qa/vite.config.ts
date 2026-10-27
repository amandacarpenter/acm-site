import { defineConfig, mergeConfig } from "vite";
import config from "../../vite.config";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"../..");
export default defineConfig(({mode})=>mergeConfig(config,{
  base: mode==="trial-preview" ? "./" : "/",
  define: { "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("preview-only-not-a-key") },
  resolve:{alias:{"@clerk/clerk-react":path.join(root,"script/trial-qa/clerk-preview.tsx")}},
  plugins:[{
    name:"explicit-trial-preview",
    transform(code:string,id:string) {
      if (id.endsWith("/client/src/main.tsx")) return `${mode==="trial-preview" ? 'if (!location.hash) location.hash = "/free-trial";\n' : ""}import "../../script/trial-qa/bootstrap";\n${code}`;
      if (mode==="trial-preview" && id.endsWith("/client/src/App.tsx")) return `import { useHashLocation } from "wouter/use-hash-location";\n${code.replace('<Router base="">','<Router hook={useHashLocation}>')}`;
      if (mode==="trial-preview" && (id.endsWith("/SignupPage.tsx") || id.endsWith("/LoginPage.tsx"))) return code.replace('new URLSearchParams(window.location.search).get("trial") === "1"','true');
    },
    transformIndexHtml(html:string) {
      // Remove analytics and other remote scripts from the review build.
      return html.replace(/<script>[\s\S]*?<\/script>/g,"").replaceAll('href="/favicon','href="./favicon');
    },
  }],
  build:{outDir:path.join(root,"trial-preview-dist")},
  server:{host:"127.0.0.1",port:5173},
}));
