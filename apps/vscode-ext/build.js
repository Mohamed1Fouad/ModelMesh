const esbuild = require("esbuild");

const production = process.argv.includes("--production");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    target: "es2022",
    outdir: "out",
    external: ["vscode"],
    sourcemap: !production,
    minify: production,
    platform: "node",
    define: {
      "process.env.NODE_ENV": production ? '"production"' : '"development"',
    },
  });

  if (production) {
    await ctx.rebuild();
    await ctx.dispose();
  } else {
    await ctx.watch();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
