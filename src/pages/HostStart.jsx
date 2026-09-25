/**
 * /host-start — the single entry point for every host journey. Shows the three
 * hosting packages plus the custom "tell us your idea" path side by side.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Rocket, LifeBuoy, Crown, Lightbulb } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';
import { useAuth } from '@/lib/AuthContext';
import { Image } from '@/components/ui/image';
import { PACKAGE_IMAGES, CUSTOM_IMAGE } from '@/components/host/hostStartImages';

const ICONS = {
  self_service: Rocket,
  supported: LifeBuoy,
  fully_managed: Crown,
};

export default function HostStart() {
  const { packages } = useHostPackages();
  const { isAuthenticated } = useAuth();
  // Signed-in hosts start from their workspace (the "Host a challenge" tab);
  // everyone else goes straight into the application.
  const planLink = (key) =>
    isAuthenticated ? `/host-dashboard?package=${key}` : `/host-apply?package=${key}`;

  useEffect(() => {
    document.title = 'How do you want to host? — 53 Challenges';
  }, []);

  return (
    <main className="host-light py-14 sm:py-20">
      <div className="container-tight">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Host a challenge</p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            How do you want to host?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Pick the level of help that suits you — or tell us your idea and we'll shape it with you.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => {
            const Icon = ICONS[pkg.key] || Rocket;
            return (
              <div key={pkg.key} className="card-lift flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
                <div className="relative h-40 w-full">
                  <Image
                    src={PACKAGE_IMAGES[pkg.key]}
                    alt=""
                    className="h-full w-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-7 pt-5">
                <h2 className="font-heading text-xl font-extrabold">{pkg.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{pkg.outcome}</p>
                <p className="mt-5 font-heading text-base font-bold">{pkg.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pkg.priceNote}</p>
                <Link
                  to={planLink(pkg.key)}
                  className="mt-7 inline-flex items-center justify-center gap-2 self-stretch rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Choose {pkg.name} <ArrowRight className="h-4 w-4" />
                </Link>
                </div>
              </div>
            );
          })}

          <div className="card-lift flex flex-col overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card/60">
            <div className="relative h-40 w-full">
              <Image src={CUSTOM_IMAGE} alt="" className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="absolute bottom-3 left-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 shadow-sm">
                <Lightbulb className="h-5 w-5 text-[#F4B740]" aria-hidden="true" />
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                Custom
              </span>
            </div>
            <div className="flex flex-1 flex-col p-7 pt-5">
            <h2 className="font-heading text-xl font-extrabold">Tell us your idea</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Something unique in mind? Share it and our team will design the right format with you.
            </p>
            <p className="mt-5 font-heading text-base font-bold">No cost</p>
            <p className="mt-1 text-xs text-muted-foreground">A short chat, then a tailored proposal</p>
            <Link
              to="/host-idea"
              className="mt-7 inline-flex items-center justify-center gap-2 self-stretch rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Tell us your idea <ArrowRight className="h-4 w-4" />
            </Link>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Not sure yet? Start anywhere — nothing goes live until you've confirmed every detail with us.
        </p>
      </div>
    </main>
  );
}