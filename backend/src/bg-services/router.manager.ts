import { RouterOSAPI } from 'node-routeros';
import * as fs from 'fs';
import * as path from 'path';

class RouterManager {
  public connection: RouterOSAPI;

  constructor(host: string, username: string, password: string) {
    this.connection = new RouterOSAPI({
      host,
      user: username,
      password,
      keepalive: true,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.connection.connect();
      console.log('Connected to MikroTik router');
    } catch (error) {
      console.error('Failed to connect to MikroTik router:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.connection.close();
      console.log('Disconnected from MikroTik router');
    } catch (error) {
      console.error('Failed to disconnect from MikroTik router:', error);
      throw error;
    }
  }

  async getConnectedUsers(): Promise<string[]> {
    try {
      const activeUsers = await this.connection.write('/ip/hotspot/active/print');
      return activeUsers.map(user => user['mac-address']);
    } catch (error) {
      console.error('Failed to get connected users:', error);
      throw error;
    }
  }

  async configureHotspotRedirect(loginPage: string): Promise<void> {
    try {
      console.log('Configuring hotspot redirect...');
      await this.connection.write('/ip/hotspot/profile/set', [
        '=numbers=hsprof1', // Use the profile name you created in setupHotspotConfigurations
        '=login-by=cookie,http-chap,http-pap,mac-cookie',
        '=html-directory=hotspot',
        '=http-cookie-lifetime=3d',
        `=login-url=${loginPage}`,
      ]);
      console.log('Hotspot redirect configured successfully');
    } catch (error: any) {
      console.error('Failed to configure hotspot redirect:', error);
      if (error.response && error.response.data) {
        console.error('Error details:', error.response.data);
      }
      throw error;
    }
  }

  // async cleanupHotspotConfigurations(): Promise<void> {
  //   try {
  //     console.log('Cleaning up hotspot configurations...');
  
  //     // Remove hotspot
  //     await this.connection.write('/ip/hotspot/remove', [
  //       '=numbers=SPIDERLAN',
  //     ]);
  
  //     // Remove hotspot profile
  //     await this.connection.write('/ip/hotspot/profile/remove', [
  //       '=numbers=hsprof1',
  //     ]);
  
  //     // Remove DHCP server
  //     await this.connection.write('/ip/dhcp-server/remove', [
  //       '=numbers=dhcp1',
  //     ]);
  
  //     // Remove IP pool
  //     await this.connection.write('/ip/pool/remove', [
  //       '=numbers=hs-pool-1',
  //     ]);
  
  //     // Remove IP address from bridge
  //     const addresses = await this.connection.write('/ip/address/print', [
  //       '=interface=bridge1',
  //     ]);
  //     for (const address of addresses) {
  //       await this.connection.write('/ip/address/remove', [
  //         `=.id=${address['.id']}`,
  //       ]);
  //     }
  
  //     // Remove bridge ports
  //     const bridgePorts = await this.connection.write('/interface/bridge/port/print', [
  //       '=bridge=bridge1',
  //     ]);
  //     for (const port of bridgePorts) {
  //       await this.connection.write('/interface/bridge/port/remove', [
  //         `=.id=${port['.id']}`,
  //       ]);
  //     }
  
  //     // Remove bridge
  //     await this.connection.write('/interface/bridge/remove', [
  //       '=numbers=bridge1',
  //     ]);
  
  //     console.log('Hotspot configurations cleaned up successfully');
  //   } catch (error: any) {
  //     console.error('Failed to clean up hotspot configurations:', error);
  //     if (error.response && error.response.data) {
  //       console.error('Error details:', error.response.data);
  //     }
  //     throw error;
  //   }
  // }

  async assignIPAddress(userId: string): Promise<string> {
    try {
      const ipPool = await this.connection.write('/ip/pool/print', [
        '=name=hs-pool-1',
      ]);
      
      if (ipPool.length === 0) {
        throw new Error('IP pool not found');
      }

      const ranges = ipPool[0].ranges.split(',');
      const [startIP, endIP] = ranges[0].split('-');

      // Find the next available IP
      const usedIPs = await this.connection.write('/ip/dhcp-server/lease/print');
      let nextIP = startIP;

      while (nextIP <= endIP) {
        if (!usedIPs.some(lease => lease.address === nextIP)) {
          break;
        }
        nextIP = this.incrementIP(nextIP);
      }

      if (nextIP > endIP) {
        throw new Error('No available IP addresses');
      }

      // Assign the IP to the user
      await this.connection.write('/ip/dhcp-server/lease/add', [
        `=address=${nextIP}`,
        `=mac-address=00:00:00:00:00:00`, // Dummy MAC address
        `=comment=User:${userId}`,
      ]);

      console.log(`IP ${nextIP} assigned to user ${userId}`);
      return nextIP;
    } catch (error) {
      console.error(`Failed to assign IP address for user ${userId}:`, error);
      throw error;
    }
  }

  async enableAccess(userId: string): Promise<void> {
    try {
      const lease = await this.findLeaseByUserId(userId);
      if (!lease) {
        throw new Error(`No IP address assigned to user ${userId}`);
      }

      await this.connection.write('/ip/firewall/address-list/add', [
        '=list=allowed_users',
        `=address=${lease.address}`,
      ]);
      console.log(`Access enabled for user ${userId} with IP ${lease.address}`);
    } catch (error) {
      console.error(`Failed to enable access for user ${userId}:`, error);
      throw error;
    }
  }

  async disableAccess(userId: string): Promise<void> {
    try {
      const lease = await this.findLeaseByUserId(userId);
      if (!lease) {
        console.log(`No IP address assigned to user ${userId}`);
        return;
      }

      const addressListEntry = await this.connection.write('/ip/firewall/address-list/print', [
        '=list=allowed_users',
        `?address=${lease.address}`,
      ]);

      if (addressListEntry.length > 0) {
        await this.connection.write('/ip/firewall/address-list/remove', [
          `=.id=${addressListEntry[0]['.id']}`,
        ]);
        console.log(`Access disabled for user ${userId} with IP ${lease.address}`);
      } else {
        console.log(`User ${userId} with IP ${lease.address} not found in allowed users`);
      }
    } catch (error) {
      console.error(`Failed to disable access for user ${userId}:`, error);
      throw error;
    }
  }

  private async findLeaseByUserId(userId: string): Promise<{ address: string } | null> {
    const leases = await this.connection.write('/ip/dhcp-server/lease/print', [
      `?comment=User:${userId}`,
    ]);
    return leases.length > 0 ? { address: leases[0].address } : null;
  }

  private incrementIP(ip: string): string {
    const parts = ip.split('.').map(Number);
    parts[3]++;
    if (parts[3] > 255) {
      parts[3] = 0;
      parts[2]++;
      if (parts[2] > 255) {
        parts[2] = 0;
        parts[1]++;
        if (parts[1] > 255) {
          parts[1] = 0;
          parts[0]++;
        }
      }
    }
    return parts.join('.');
  }

  async setupHotspotConfigurations(): Promise<void> {
    try {
      console.log('Starting hotspot configuration setup...');
  
      // List and log available interfaces
      const interfaces = await this.connection.write('/interface/print');
      console.log('Available interfaces:', interfaces);
  
      const ethInterfaces = interfaces.filter(iface => iface.name.startsWith('ether'));
      console.log('Ethernet interfaces:', ethInterfaces);
  
      if (ethInterfaces.length < 2) {
        throw new Error('Not enough ethernet interfaces available. At least 2 are required.');
      }
  
      // Create a bridge for the hotspot
      console.log('Creating bridge...');
      await this.connection.write('/interface/bridge/add', [
        '=name=bridge1',
      ]);
  
      // Verify bridge creation
      const bridges = await this.connection.write('/interface/bridge/print');
      console.log('Bridges after creation:', bridges);
  
      // Add ethernet interfaces to the bridge
      console.log('Adding interfaces to bridge...');
      for (let i = 0; i < 2; i++) {
        await this.connection.write('/interface/bridge/port/add', [
          '=bridge=bridge1',
          `=interface=${ethInterfaces[i].name}`,
        ]);
        console.log(`Added ${ethInterfaces[i].name} to bridge1`);
      }
  
      // Set up IP address for the hotspot
      console.log('Setting up IP address for hotspot...');
      await this.connection.write('/ip/address/add', [
        '=address=10.5.50.1/24',
        '=interface=bridge1',
      ]);
  
      // Create IP pool for hotspot clients
      console.log('Creating IP pool for hotspot clients...');
      await this.connection.write('/ip/pool/add', [
        '=name=hs-pool-1',
        '=ranges=10.5.50.2-10.5.50.254',
      ]);
  
      // Set up DHCP server
      console.log('Setting up DHCP server...');
      await this.connection.write('/ip/dhcp-server/add', [
        '=name=dhcp1',
        '=interface=bridge1',
        '=address-pool=hs-pool-1',
        '=lease-time=1h',
      ]);
  
      // Create hotspot profile
      console.log('Creating hotspot profile...');
      await this.connection.write('/ip/hotspot/profile/add', [
        '=name=hsprof1',
        '=hotspot-address=10.5.50.1',
        '=dns-name=hotspot.spiderlan.net',
        '=html-directory=hotspot',
        '=login-by=cookie,http-chap,http-pap,mac-cookie',
      ]);
  
      // Enable hotspot on the bridge interface
      console.log('Enabling hotspot on bridge interface...');
      await this.connection.write('/ip/hotspot/add', [
        '=name=SPIDERLAN',
        '=interface=bridge1',
        '=address-pool=hs-pool-1',
        '=profile=hsprof1',
        '=addresses-per-mac=2',
      ]);
  
      console.log('Hotspot configurations set up successfully');
    } catch (error: any) {
      console.error('Failed to set up hotspot configurations:', error);
      if (error.response && error.response.data) {
        console.error('Error details:', error.response.data);
      }
      throw error;
    }
  }

  async configureHotspotSettings(ssid: string, loginPage: string): Promise<void> {
    try {
      console.log('Configuring hotspot settings...');
  
      // Configure hotspot profile
      await this.connection.write('/ip/hotspot/profile/set', [
        '=numbers=hsprof1',
        '=login-by=cookie,http-chap,http-pap,mac-cookie',
        '=html-directory=hotspot',
        '=http-cookie-lifetime=3d',
      ]);
  
      // Set login page separately
      await this.connection.write('/ip/hotspot/profile/set', [
        '=numbers=hsprof1',
        `=login-page=${loginPage}`,
      ]);
  
      // Set SSID for the hotspot
      await this.connection.write('/ip/hotspot/set', [
        '=name=SPIDERLAN',
        `=hotspot-address=${ssid}`,
        '=disabled=no',
        
      ]);
  
      console.log('Hotspot settings configured successfully');
    } catch (error: any) {
      console.error('Failed to configure hotspot settings:', error);
      if (error.response && error.response.data) {
        console.error('Error details:', error.response.data);
      }
      throw error;
    }
  }

  async uploadHotspotTemplate(templatePath: string): Promise<void> {
    try {
      console.log('Uploading hotspot template...');
      const content = await fs.promises.readFile(templatePath, 'utf8');
      const fileName = path.basename(templatePath);
  
      // Remove existing file if it exists
      await this.connection.write('/file/remove', [
        `=numbers=hotspot/${fileName}`,
      ]);
  
      // Create the new file
      await this.connection.write('/file/add', [
        `=name=hotspot/${fileName}`,
        `=contents=${content}`,
      ]);
  
      console.log('Hotspot template uploaded successfully');
  
      // Verify the file was created
      const files = await this.connection.write('/file/print', [
        `?name=hotspot/${fileName}`,
      ]);
  
      if (files.length === 0) {
        throw new Error('File was not created successfully');
      }
  
      console.log('File verified in RouterOS');
    } catch (error: any) {
      console.error('Failed to upload hotspot template:', error);
      if (error.response && error.response.data) {
        console.error('Error details:', error.response.data);
      }
      throw error;
    }
  }
}
  

export default RouterManager;
