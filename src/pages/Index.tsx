import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="mb-4 text-4xl font-bold">Welcome to QubeBase</h1>
        <p className="text-xl text-muted-foreground">Explore your platform statistics</p>
        <Link to="/dashboard">
          <Button size="lg" className="gap-2">
            <BarChart3 className="h-5 w-5" />
            View Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
