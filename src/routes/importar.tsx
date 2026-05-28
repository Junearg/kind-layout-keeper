import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ImportClientesPanel } from "@/components/ImportClientesPanel";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar · Fudo Churn Center" }] }),
  component: ImportarPage,
});

function ImportarPage() {
  return (
    <Layout>
      <ImportClientesPanel />
    </Layout>
  );
}
