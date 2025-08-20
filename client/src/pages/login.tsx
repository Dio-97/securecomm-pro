import { useState } from "react";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface LoginProps {
  onLogin: (user: any) => void;
  onWebSocketAuth: (username: string, password: string) => void;
}

export default function Login({ onLogin, onWebSocketAuth }: LoginProps) {
  const [step, setStep] = useState<"username" | "password">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUsernameSubmit = () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }
    setStep("password");
  };

  const handleLogin = async () => {
    if (!password || twoFactorCode.length !== 6) {
      toast({
        title: "Error",
        description: "Please fill in all fields with valid values",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await login({ username, password, twoFactorCode });
      onLogin(result.user);
      onWebSocketAuth(username, password);
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("username");
    setPassword("");
    setTwoFactorCode("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-primary-foreground text-2xl" />
              </div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">SecureComm Pro</h1>
              <p className="text-sm text-muted-foreground">Encrypted Business Communications</p>
            </div>
            
            {step === "username" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username" className="text-muted-foreground">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="mt-2"
                    onKeyDown={(e) => e.key === "Enter" && handleUsernameSubmit()}
                  />
                </div>
                <Button onClick={handleUsernameSubmit} className="w-full">
                  Continue
                </Button>
              </div>
            )}
            
            {step === "password" && (
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <Button variant="ghost" size="sm" onClick={handleBack} className="p-2">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-medium text-foreground ml-2">{username}</span>
                </div>
                
                <div>
                  <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="twoFactor" className="text-muted-foreground">2FA Code</Label>
                  <Input
                    id="twoFactor"
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="mt-2"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                
                <Button 
                  onClick={handleLogin} 
                  className="w-full" 
                  disabled={loading}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {loading ? "Authenticating..." : "Secure Login"}
                </Button>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                <Shield className="w-3 h-3 inline mr-1" />
                End-to-end encrypted • IP Masked • Zero Knowledge
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
