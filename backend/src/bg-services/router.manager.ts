import { RouterOSAPI } from 'node-routeros';

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

  async enableAccess(clientMac: string): Promise<void> {
    try {
      await this.connection.write('/ip/hotspot/active/add', [
        `=mac-address=${clientMac}`,
      ]);
      console.log(`Access enabled for client: ${clientMac}`);
    } catch (error) {
      console.error(`Failed to enable access for client ${clientMac}:`, error);
      throw error;
    }
  }

  async disableAccess(clientMac: string): Promise<void> {
    try {
      const activeUsers = await this.connection.write('/ip/hotspot/active/print', [
        `?mac-address=${clientMac}`,
      ]);
      
      if (activeUsers.length > 0) {
        await this.connection.write('/ip/hotspot/active/remove', [
          `=.id=${activeUsers[0]['.id']}`,
        ]);
        console.log(`Access disabled for client: ${clientMac}`);
      } else {
        console.log(`Client ${clientMac} not found in active users`);
      }
    } catch (error) {
      console.error(`Failed to disable access for client ${clientMac}:`, error);
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
}

export default RouterManager;
