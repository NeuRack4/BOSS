import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ScenarioSection from "@/components/ScenarioSection";
import FeaturesSection from "@/components/FeaturesSection";
import TriggerSection from "@/components/TriggerSection";
import StackSection from "@/components/StackSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

function SectionDivider() {
  return (
    <div className="relative flex items-center justify-center py-1 max-w-5xl mx-auto px-6">
      <div className="absolute inset-x-6 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      <div className="relative w-2 h-2 rounded-full bg-white border-2 border-gray-300" />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Header />
      <HeroSection />
      <SectionDivider />
      <ScenarioSection />
      <SectionDivider />
      <FeaturesSection />
      <SectionDivider />
      <TriggerSection />
      <SectionDivider />
      <StackSection />
      <SectionDivider />
      <CTASection />
      <Footer />
    </main>
  );
}
