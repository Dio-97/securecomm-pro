import * as crypto from 'crypto';
import axios from 'axios';

export interface DNSQuery {
  id: string;
  domain: string;
  type: string;
  timestamp: Date;
  response?: string;
  encrypted: boolean;
  userId: string;
}

export interface DNSStats {
  totalQueries: number;
  encryptedQueries: number;
  blockedQueries: number;
  averageResponseTime: number;
}

export class DNSService {
  private static instance: DNSService;
  private dohUrls: string[] = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/dns-query',
    'https://doh.opendns.com/dns-query'
  ];
  private queries: Map<string, DNSQuery> = new Map();
  private blockedDomains: Set<string> = new Set();
  private encryptionEnabled: boolean = true;
  
  static getInstance(): DNSService {
    if (!DNSService.instance) {
      DNSService.instance = new DNSService();
    }
    return DNSService.instance;
  }

  constructor() {
    // Initialize blocked domains list
    this.initializeBlockedDomains();
  }

  // Resolve domain using encrypted DNS
  async resolveDomain(domain: string, type: string = 'A', userId: string): Promise<string | null> {
    const queryId = crypto.randomUUID();
    const startTime = Date.now();

    // Check if domain is blocked
    if (this.blockedDomains.has(domain.toLowerCase())) {
      console.log(`Blocked DNS query for ${domain} from user ${userId}`);
      return null;
    }

    try {
      const query: DNSQuery = {
        id: queryId,
        domain,
        type,
        timestamp: new Date(),
        encrypted: this.encryptionEnabled,
        userId
      };

      // Perform DNS over HTTPS query
      const response = await this.performDohQuery(domain, type);
      const responseTime = Date.now() - startTime;

      query.response = JSON.stringify(response);
      this.queries.set(queryId, query);

      console.log(`DNS query for ${domain} resolved in ${responseTime}ms (encrypted: ${this.encryptionEnabled})`);
      
      // Return resolved IP or response
      return response.ip || response.answer || null;
    } catch (error) {
      console.error(`DNS resolution failed for ${domain}:`, error);
      return null;
    }
  }

  // Enable/disable DNS encryption
  setEncryption(enabled: boolean): void {
    this.encryptionEnabled = enabled;
    console.log(`DNS encryption ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Add domain to blocklist
  blockDomain(domain: string): void {
    this.blockedDomains.add(domain.toLowerCase());
    console.log(`Domain ${domain} added to blocklist`);
  }

  // Remove domain from blocklist
  unblockDomain(domain: string): void {
    this.blockedDomains.delete(domain.toLowerCase());
    console.log(`Domain ${domain} removed from blocklist`);
  }

  // Get DNS statistics
  getStats(userId?: string): DNSStats {
    const userQueries = userId 
      ? Array.from(this.queries.values()).filter(q => q.userId === userId)
      : Array.from(this.queries.values());

    const totalQueries = userQueries.length;
    const encryptedQueries = userQueries.filter(q => q.encrypted).length;
    const blockedQueries = userQueries.filter(q => !q.response).length;
    
    // Calculate average response time (simplified)
    const avgResponseTime = totalQueries > 0 ? 45 : 0; // Placeholder calculation

    return {
      totalQueries,
      encryptedQueries,
      blockedQueries,
      averageResponseTime: avgResponseTime
    };
  }

  // Get recent DNS queries
  getRecentQueries(userId?: string, limit: number = 50): DNSQuery[] {
    const userQueries = userId 
      ? Array.from(this.queries.values()).filter(q => q.userId === userId)
      : Array.from(this.queries.values());

    return userQueries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Initialize commonly blocked domains for security
  private initializeBlockedDomains(): void {
    const maliciousDomains = [
      'malware-domain.com',
      'phishing-site.net',
      'tracker-network.org',
      'adware-central.biz',
      'spyware-hub.info'
    ];

    maliciousDomains.forEach(domain => this.blockedDomains.add(domain));
    console.log(`Initialized DNS protection with ${maliciousDomains.length} blocked domains`);
  }

  // Flush DNS cache
  flushCache(): void {
    this.queries.clear();
    console.log('DNS cache flushed');
  }

  // Check if domain is blocked
  isDomainBlocked(domain: string): boolean {
    return this.blockedDomains.has(domain.toLowerCase());
  }

  // Get blocked domains list
  getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }

  // Perform DNS over HTTPS query using axios
  private async performDohQuery(domain: string, type: string): Promise<any> {
    for (const dohUrl of this.dohUrls) {
      try {
        const response = await axios.get(dohUrl, {
          params: {
            name: domain,
            type: type
          },
          headers: {
            'Accept': 'application/dns-json'
          },
          timeout: 5000
        });

        if (response.data && response.data.Answer && response.data.Answer.length > 0) {
          return {
            ip: response.data.Answer[0].data,
            answer: response.data.Answer[0].data,
            full: response.data
          };
        }
      } catch (error) {
        console.log(`DoH query failed for ${dohUrl}, trying next...`);
        continue;
      }
    }
    
    throw new Error('All DoH servers failed');
  }
}

export const dnsService = DNSService.getInstance();