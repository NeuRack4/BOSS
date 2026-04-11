import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ScenarioSection from "@/components/ScenarioSection";
import FeaturesSection from "@/components/FeaturesSection";
import TriggerSection from "@/components/TriggerSection";
import StackSection from "@/components/StackSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Header />
      <HeroSection />
      <ScenarioSection />
      <FeaturesSection />
      <TriggerSection />
      <StackSection />
      <CTASection />
      <Footer />
    </main>
  );
}
