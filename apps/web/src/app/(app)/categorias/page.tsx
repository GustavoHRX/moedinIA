"use client";

import { useState } from "react";
import { Alert, PageFrame, PageHeader, Surface } from "@/components/ui-kit";
import { CategoryManager } from "@/components/category-manager";

export default function CategoriasPage() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  return (
    <PageFrame>
      <PageHeader
        title="Categorias"
        description="As etiquetas que colorem seus lançamentos, gráficos e resumos."
      />

      <div className="space-y-4">
        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <Surface>
          <CategoryManager
            onMessage={(text, type) => {
              setMessage(text);
              setMessageType(type);
            }}
          />
        </Surface>
      </div>
    </PageFrame>
  );
}
