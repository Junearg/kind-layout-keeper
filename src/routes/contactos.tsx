import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ChurnedSection } from "@/components/ChurnedSection";

export const Route = createFileRoute("/contactos")({
  head: () => ({ meta: [{ title: "Contact Churn · Fudo Customer Center" }] }),
  component: ContactosPage,
});

function ContactosPage() {
  return (
    <Layout>
      <ChurnedSection />
    </Layout>
  );
}
