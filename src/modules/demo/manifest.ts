import "server-only";
import { defineModule } from "@/lib/modules/define";
import { Categoria } from "./models/categoria";
import { Tarea } from "./models/tarea";

/** Disposable prototype of the declarative module approach (phase 2). Not part of the tutorial. */
export default defineModule({
  id: "demo",
  name: "Demo módulos",
  icon: "flask-conical",
  models: {
    tarea: { model: Tarea, kanban: "estado" },
    categoria: Categoria,
  },
  menu: {
    Tareas: "tarea",
    Configuración: { Categorías: "categoria" },
  },
});
