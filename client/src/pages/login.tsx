import { useState, useEffect } from "react";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useTheme } from "@/components/theme-provider";
import { 
  login, 
  attemptAutoLogin, 
  saveCredentials, 
  isPersistentLoginEnabled, 
  enablePersistentLogin, 
  disablePersistentLogin,
  getStoredCredentials,
  getDecryptedPassword
} from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface LoginProps {
  onLogin: (user: any) => void;
  onWebSocketAuth: (username: string, password: string) => void;
}

export default function Login({ onLogin, onWebSocketAuth }: LoginProps) {
  const [step, setStep] = useState<"username" | "password">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [persistentLogin, setPersistentLogin] = useState(isPersistentLoginEnabled());
  const [isAutoLoginAttempting, setIsAutoLoginAttempting] = useState(true);
  const { toast } = useToast();

  // Attempt auto-login on component mount
  useEffect(() => {
    const attemptAutoLoginAsync = async () => {
      try {
        const result = await attemptAutoLogin();
        if (result) {
          onLogin(result.user);
          const storedCreds = getStoredCredentials();
          if (storedCreds) {
            onWebSocketAuth(storedCreds.username, getDecryptedPassword(storedCreds));
          }
          return;
        }
      } catch (error) {
        console.log("Auto-login failed, showing login form");
      }
      
      // If auto-login fails or no stored credentials, populate username if available
      const storedCreds = getStoredCredentials();
      if (storedCreds) {
        setUsername(storedCreds.username);
        setStep("password");
      }
      
      setIsAutoLoginAttempting(false);
    };

    attemptAutoLoginAsync();
  }, [onLogin, onWebSocketAuth]);

  const handleUsernameSubmit = () => {
    if (!username.trim()) {
      toast({ duration: 1000, 
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }
    setStep("password");
  };

  const handleLogin = async () => {
    if (!password) {
      toast({ duration: 1000, 
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update persistent login setting
      if (persistentLogin) {
        enablePersistentLogin();
      } else {
        disablePersistentLogin();
      }

      const result = await login({ username, password });
      
      // Save credentials if persistent login is enabled
      if (persistentLogin) {
        saveCredentials(username, password);
      }
      
      onLogin(result.user);
      onWebSocketAuth(username, password);
    } catch (error: any) {
      toast({ duration: 1000, 
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
  };

  // Show loading screen during auto-login attempt
  if (isAutoLoginAttempting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border">
            <CardContent className="pt-8 pb-8 px-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="text-primary-foreground text-2xl animate-pulse" />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-foreground">SecureComm Pro</h1>
                <p className="text-sm text-muted-foreground mb-4">Checking saved credentials...</p>
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="persistent-login"
                    checked={persistentLogin}
                    onCheckedChange={(checked) => setPersistentLogin(!!checked)}
                  />
                  <Label 
                    htmlFor="persistent-login" 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Keep me signed in (remember credentials)
                  </Label>
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
