import { defineConfig, mergeConfig } from "vite";
import config from "../../vite.config";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"../..");
export default defineConfig(({mode})=>mergeConfig(config,{
  base: mode==="trial-preview" ? "./" : "/",
  define: { "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify("preview-only-not-a-key") },
  resolve:{alias:{
    "@clerk/clerk-react":path.join(root,"script/trial-qa/clerk-preview.tsx"),
    "util-deprecate":path.join(root,"script/trial-qa/deprecate-preview.cjs"),
  }},
  plugins:[{
    name:"explicit-trial-preview",
    enforce:"pre",
    transform(code:string,id:string) {
      // The deprecation helper only uses browser storage for optional logging
      // flags. In the review build, always use its default logging behavior;
      // remove the storage-reading function rather than hiding its API name.
      if (mode==="trial-preview" && (id.endsWith("/util-deprecate/browser.js") || id.endsWith("/pdfkit/js/pdfkit.standalone.js"))) {
        return code.replace(/function config \(name\) \{[\s\S]*?return String\(val\)\.toLowerCase\(\) === 'true';\s*\}/,
          "function config(name) { return false; }");
      }
      if (id.endsWith("/client/src/main.tsx")) return `import "../../script/trial-qa/bootstrap";\n${code}`;
      if (mode==="trial-preview" && id.endsWith("/client/src/App.tsx")) return `import { usePreviewLocation } from "../../script/trial-qa/memory-location";\n${code.replace('<Router base="">','<Router hook={usePreviewLocation}>')}`;
      if (mode==="trial-preview" && (id.endsWith("/SignupPage.tsx") || id.endsWith("/LoginPage.tsx"))) return code.replace('new URLSearchParams(window.location.search).get("trial") === "1"','true');
      if (mode==="trial-preview" && id.endsWith("/ToolsPage.tsx")) return code.replace('window.history.pushState({}, "", `/tools/${id}`);','navigate(`/tools/${id}`);');
    },
    transformIndexHtml(html:string) {
      // Remove analytics and other remote scripts from the review build.
      return html.replace(/<script>[\s\S]*?<\/script>/g,"").replaceAll('href="/favicon','href="./favicon');
    },
    renderChunk(code:string) {
      if (mode !== "trial-preview") return;
      // CommonJS can wrap a second copy of the deprecation helper after the
      // source transform. Its only storage reads are optional logging flags.
      // Replace those reads with an empty transient object: no browser storage
      // is accessed, and the helper always uses its default warning behavior.
      return {code:code.replace(/\b[A-Za-z_$][\w$]*\.localStorage\b/g, "({})"), map:null};
    },
  }],
  build:{
    outDir:path.join(root,"trial-preview-dist"),
    ...(mode==="trial-preview" ? {
      cssCodeSplit:false,
      assetsInlineLimit:2_000_000,
      rollupOptions:{output:{inlineDynamicImports:true}},
    } : {}),
  },
  server:{host:"127.0.0.1",port:5173},
}));
