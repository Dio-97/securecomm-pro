import { randomUUID } from "crypto";

interface VPNServer {
  id: string;
  name: string;
  country: string;
  city: string;
  load: number;
  ip: string;
}

export class VPNService {
  private vpnServers: VPNServer[] = [
    { id: "1", name: "SecureNode-1", country: "Switzerland", city: "Zurich", load: 15, ip: "185.234.218.42" },
    { id: "2", name: "SecureNode-2", country: "Netherlands", city: "Amsterdam", load: 23, ip: "45.153.187.96" },
    { id: "3", name: "SecureNode-3", country: "Norway", city: "Oslo", load: 8, ip: "91.219.237.151" },
    { id: "4", name: "SecureNode-4", country: "Iceland", city: "Reykjavik", load: 12, ip: "82.221.139.73" },
    { id: "5", name: "SecureNode-5", country: "Romania", city: "Bucharest", load: 31, ip: "37.120.152.89" },
    { id: "6", name: "SecureNode-6", country: "Czech Republic", city: "Prague", load: 19, ip: "185.8.172.134" },
    { id: "7", name: "SecureNode-7", country: "Malta", city: "Valletta", load: 7, ip: "185.158.249.67" },
    { id: "8", name: "SecureNode-8", country: "Cyprus", city: "Nicosia", load: 25, ip: "194.61.53.98" }
  ];

  private getRandomVPNServer(): VPNServer {
    // Prefer servers with lower load
    const lowLoadServers = this.vpnServers.filter(server => server.load < 30);
    const availableServers = lowLoadServers.length > 0 ? lowLoadServers : this.vpnServers;
    
    return availableServers[Math.floor(Math.random() * availableServers.length)];
  }

  public maskIP(realIp: string): { maskedIp: string; vpnServer: VPNServer } {
    const vpnServer = this.getRandomVPNServer();
    
    // Generate a masked IP that appears to be from the VPN server's subnet
    const baseIp = vpnServer.ip.split('.').slice(0, 3).join('.');
    const lastOctet = Math.floor(Math.random() * 254) + 1;
    const maskedIp = `${baseIp}.${lastOctet}`;
    
    // Update server load
    const server = this.vpnServers.find(s => s.id === vpnServer.id);
    if (server) {
      server.load = Math.min(100, server.load + Math.floor(Math.random() * 5) + 1);
    }
    
    return {
      maskedIp,
      vpnServer
    };
  }

  public rotateVPN(currentVpnId?: string): { maskedIp: string; vpnServer: VPNServer } {
    // Decrease load on current server
    if (currentVpnId) {
      const currentServer = this.vpnServers.find(s => s.id === currentVpnId);
      if (currentServer) {
        currentServer.load = Math.max(0, currentServer.load - Math.floor(Math.random() * 3) + 1);
      }
    }
    
    // Get a different server
    const availableServers = currentVpnId 
      ? this.vpnServers.filter(s => s.id !== currentVpnId)
      : this.vpnServers;
    
    const vpnServer = availableServers[Math.floor(Math.random() * availableServers.length)];
    
    const baseIp = vpnServer.ip.split('.').slice(0, 3).join('.');
    const lastOctet = Math.floor(Math.random() * 254) + 1;
    const maskedIp = `${baseIp}.${lastOctet}`;
    
    // Update server load
    const server = this.vpnServers.find(s => s.id === vpnServer.id);
    if (server) {
      server.load = Math.min(100, server.load + Math.floor(Math.random() * 5) + 1);
    }
    
    return {
      maskedIp,
      vpnServer
    };
  }

  public getAllServers(): VPNServer[] {
    return this.vpnServers.map(server => ({ ...server }));
  }

  public getServerStatus(serverId: string): VPNServer | undefined {
    return this.vpnServers.find(s => s.id === serverId);
  }

  // Simulate periodic load balancing
  public startLoadBalancing(): void {
    setInterval(() => {
      this.vpnServers.forEach(server => {
        // Gradually reduce load over time
        server.load = Math.max(0, server.load - Math.floor(Math.random() * 3));
        
        // Random fluctuations
        if (Math.random() < 0.1) {
          server.load = Math.min(100, server.load + Math.floor(Math.random() * 10));
        }
      });
    }, 30000); // Every 30 seconds
  }
}

export const vpnService = new VPNService();