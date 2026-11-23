// Contrôle après déploiement : la page et le bundle client répondent 200.
const urls = {
  prod: "https://competitions-judo.vercel.app",
  dev: "https://competitions-judo-dev.vercel.app"
};

function argument(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const baseUrl = urls[argument("environment")];
  if (!baseUrl) throw new Error("--environment doit être prod ou dev.");

  for (const pathname of ["/", `/api/client?v=${Date.now()}`]) {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: "follow" });
    if (response.status !== 200) {
      throw new Error(`${baseUrl}${pathname} répond ${response.status}.`);
    }
    console.log(`200 ${baseUrl}${pathname}`);
  }
}

main().catch((error) => {
  console.error(`Contrôle après déploiement en échec : ${error.message}`);
  process.exit(1);
});
