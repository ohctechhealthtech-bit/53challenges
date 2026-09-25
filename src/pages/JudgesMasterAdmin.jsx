/**
 * /judges-master — admin management of the judges master (external API).
 */
import JudgesMasterPanel from '@/components/judges/JudgesMasterPanel';

export default function JudgesMasterAdmin() {
  return (
    <main className="container-tight py-10">
      <h1 className="font-heading text-3xl font-extrabold">Judges master</h1>
      <div className="mt-6">
        <JudgesMasterPanel />
      </div>
    </main>
  );
}