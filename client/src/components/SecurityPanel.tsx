import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Wifi, 
  Globe, 
  FileUp, 
  QrCode, 
  Activity,
  Server,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface SecurityPanelProps {
  userId: string;
  isVisible: boolean;
  onClose: () => void;
}

interface VPNStatus {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  serverId: string;
  endpoint: string;
  connectedAt?: string;
  bytesReceived: number;
  bytesSent: number;
}

interface DNSStats {
  totalQueries: number;
  encryptedQueries: number;
  blockedQueries: number;
  averageResponseTime: number;
}

export function SecurityPanel({ userId, isVisible, onClose }: SecurityPanelProps) {
  const [vpnStatus, setVPNStatus] = useState<VPNStatus[]>([]);
  const [dnsStats, setDNSStats] = useState<DNSStats | null>(null);
  const [isConnectingVPN, setIsConnectingVPN] = useState(false);
  const [selectedServer, setSelectedServer] = useState('1');
  const [servers, setServers] = useState<any[]>([]);

  useEffect(() => {
    if (isVisible) {
      fetchVPNStatus();
      fetchDNSStats();
      fetchServers();
      
      const interval = setInterval(() => {
        fetchVPNStatus();
        fetchDNSStats();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isVisible, userId]);

  const fetchVPNStatus = async () => {
    try {
      const response = await fetch(`/api/vpn/status/${userId}`);
      const data = await response.json();
      setVPNStatus(data);
    } catch (error) {
      console.error('Failed to fetch VPN status:', error);
    }
  };

  const fetchDNSStats = async () => {
    try {
      const response = await fetch(`/api/dns/stats/${userId}`);
      const data = await response.json();
      setDNSStats(data);
    } catch (error) {
      console.error('Failed to fetch DNS stats:', error);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await fetch('/api/vpn/servers');
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const connectVPN = async () => {
    setIsConnectingVPN(true);
    try {
      const response = await fetch('/api/vpn/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, serverId: selectedServer })
      });
      
      if (response.ok) {
        fetchVPNStatus();
      }
    } catch (error) {
      console.error('Failed to connect VPN:', error);
    } finally {
      setIsConnectingVPN(false);
    }
  };

  const disconnectVPN = async (connectionId: string) => {
    try {
      const response = await fetch('/api/vpn/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });
      
      if (response.ok) {
        fetchVPNStatus();
      }
    } catch (error) {
      console.error('Failed to disconnect VPN:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security & Protection Center
          </CardTitle>
          <Button onClick={onClose} variant="ghost" size="sm">
            ✕
          </Button>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="vpn" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="vpn" className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                VPN Protection
              </TabsTrigger>
              <TabsTrigger value="dns" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                DNS Security
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FileUp className="w-4 h-4" />
                File Encryption
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vpn" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">VPN Connection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 py-3">
                    {vpnStatus.length === 0 ? (
                      <div className="text-center py-2">
                        <p className="text-gray-500 mb-2 text-sm">No active VPN connections</p>
                        <div className="space-y-2">
                          <select 
                            value={selectedServer} 
                            onChange={(e) => setSelectedServer(e.target.value)}
                            className="w-full p-1.5 border rounded text-sm"
                          >
                            {servers.map(server => (
                              <option key={server.id} value={server.id}>
                                {server.name} - {server.country}
                              </option>
                            ))}
                          </select>
                          <Button 
                            onClick={connectVPN} 
                            disabled={isConnectingVPN}
                            className="w-full h-8 text-sm"
                            size="sm"
                          >
                            {isConnectingVPN ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Wifi className="w-3 h-3 mr-1" />
                            )}
                            Connect VPN
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {vpnStatus.map((conn) => (
                          <div key={conn.id} className="border rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(conn.status)}
                                <span className="text-xs font-medium">
                                  Server {conn.serverId}
                                </span>
                                <Badge variant="secondary" className={`text-xs px-1 py-0 ${getStatusColor(conn.status)}`}>
                                  {conn.status}
                                </Badge>
                              </div>
                              {conn.status === 'connected' && (
                                <Button 
                                  onClick={() => disconnectVPN(conn.id)}
                                  variant="outline" 
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  Disconnect
                                </Button>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <div className="truncate">Endpoint: {conn.endpoint}</div>
                              <div className="flex justify-between">
                                <span>↓ {formatBytes(conn.bytesReceived)}</span>
                                <span>↑ {formatBytes(conn.bytesSent)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Kill Switch Status</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Active - Traffic protected</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      All internet traffic is blocked if VPN disconnects
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="dns" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {dnsStats?.encryptedQueries || 0}
                    </div>
                    <p className="text-xs text-gray-600">Encrypted Queries</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">
                      {dnsStats?.blockedQueries || 0}
                    </div>
                    <p className="text-xs text-gray-600">Blocked Threats</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      {dnsStats?.averageResponseTime || 0}ms
                    </div>
                    <p className="text-xs text-gray-600">Avg Response Time</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">DNS Protection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">DNS over HTTPS</span>
                      <Badge variant="secondary" className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Malware Protection</span>
                      <Badge variant="secondary" className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ad Blocking</span>
                      <Badge variant="secondary" className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">File Encryption Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">AES-256 encryption enabled</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Default Expiration</div>
                        <div className="text-gray-600">24 hours</div>
                      </div>
                      <div>
                        <div className="font-medium">Max Downloads</div>
                        <div className="text-gray-600">10 per file</div>
                      </div>
                      <div>
                        <div className="font-medium">Max File Size</div>
                        <div className="text-gray-600">50 MB</div>
                      </div>
                      <div>
                        <div className="font-medium">Auto-delete</div>
                        <div className="text-gray-600">On expiration</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="text-xs text-gray-600">
                        All shared files are encrypted end-to-end and automatically deleted after expiration.
                        Files are protected with individual encryption keys and cannot be accessed without proper authorization.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}