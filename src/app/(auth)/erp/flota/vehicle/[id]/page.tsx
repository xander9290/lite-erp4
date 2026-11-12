import { Suspense } from "react";
import Editor from "../../views/VehicleForm";
type Props = { params: Promise<{id: string}> };
async function OpenRecord({ params }: Props) { const { id } = await params; return <Editor id={id} />; }
export default function Page(props: Props) { return <><Suspense fallback={<p role="status" className="p-6">Cargando…</p>}><OpenRecord {...props} /></Suspense></>; }
