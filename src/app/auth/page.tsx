import FormLogin from "@/components/login/FormLogin";

export default function page() {
  return (
    <main className="flex min-h-0 flex-1 overflow-y-auto rounded-xl bg-linear-to-br from-primary/5 via-base-200 to-base-200 p-4 sm:p-6">
      <div className="mx-auto mb-auto mt-4 w-full max-w-md py-4 sm:mt-8 sm:py-8">
        <FormLogin />
      </div>
    </main>
  );
}
