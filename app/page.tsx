import { CountdownClock } from '@/components/countdown-clock';
import { InstallPrompt } from '@/components/install-prompt';
import { ServiceWorkerRegister } from '@/components/service-worker-register';

export default function HomePage() {
  return (
    <>
      <ServiceWorkerRegister />
      <section className="gate">
        <h1>Liggende tablet</h1>
        <p>
          Draai je tablet naar liggende stand. Deze aftelklok werkt alleen op een tablet in landscape.
        </p>
      </section>
      <CountdownClock />
      <InstallPrompt />
    </>
  );
}
