import { useState, useEffect } from "react";
import { Shield, RefreshCw, Globe, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface VPNServer {
  id: string;
  name: string;
  country: string;
  city: string;
  load: number;
  ip: string;
}

interface VPNStatusProps {
  user: User;
  onVPNRotate: (newData: { maskedIp: string; vpnServer: string; vpnCountry: string; location: string }) => void;
}

export function VPNStatus({ user, onVPNRotate }: VPNStatusProps) {
  const [servers, setServers] = useState<VPNServer[]>([]);
  const [isRotating, setIsRotating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchServers = async () => {
    try {
      const response = await apiRequest("GET", "/api/vpn/servers");
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch VPN servers:', error);
    }
  };

  const handleRotateVPN = async () => {
    setIsRotating(true);
    try {
      const response = await apiRequest("POST", "/api/vpn/rotate", {
        userId: user.id
      });
      const newData = await response.json();
      
      onVPNRotate(newData);
      
      toast({ duration: 1000, 
        title: "VPN Rotated Successfully",
        description: `Connected to ${newData.vpnServer} in ${newData.vpnCountry}`,
      });
    } catch (error) {
      toast({ duration: 1000, 
        title: "VPN Rotation Failed",
        description: "Could not rotate VPN connection",
        variant: "destructive",
      });
    } finally {
      setIsRotating(false);
    }
  };

  const currentServer = servers.find(s => s.name === user.vpnServer);
  const getLoadColor = (load: number) => {
    if (load < 30) return "bg-green-500";
    if (load < 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLoadBadgeVariant = (load: number) => {
    if (load < 30) return "default";
    if (load < 70) return "secondary";
    return "destructive";
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">VPN Protected</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotateVPN}
            disabled={isRotating}
            className="text-xs"
          >
            {isRotating ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Rotate
          </Button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Masked IP:</span>
            <span className="font-mono">{user.maskedIp}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">VPN Server:</span>
            <div className="flex items-center space-x-2">
              <span>{user.vpnServer}</span>
              {currentServer && (
                <Badge 
                  variant={getLoadBadgeVariant(currentServer.load)}
                  className="text-xs px-1 py-0"
                >
                  {currentServer.load}%
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Location:</span>
            <div className="flex items-center space-x-1">
              <Globe className="w-3 h-3" />
              <span>{user.location}</span>
            </div>
          </div>

          {currentServer && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Server Load:</span>
              <div className="flex items-center space-x-2">
                <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getLoadColor(currentServer.load)} transition-all duration-300`}
                    style={{ width: `${currentServer.load}%` }}
                  ></div>
                </div>
                <span className="text-xs">{currentServer.load}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span>Auto-rotation every 15 minutes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}