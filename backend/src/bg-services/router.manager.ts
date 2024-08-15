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

  async setupHotspotConfigurations(): Promise<void> {
    try {
      // Create a bridge for the hotspot
      await this.connection.write('/interface/bridge/add', [
        '=name=bridge1',
      ]);

      // Add ethernet interfaces to the bridge
      await this.connection.write('/interface/bridge/port/add', [
        '=bridge=bridge1',
        '=interface=ether2',
      ]);
      await this.connection.write('/interface/bridge/port/add', [
        '=bridge=bridge1',
        '=interface=ether3',
      ]);

      // Set up IP address for the hotspot
      await this.connection.write('/ip/address/add', [
        '=address=10.5.50.1/24',
        '=interface=bridge1',
      ]);

      // Create IP pool for hotspot clients
      await this.connection.write('/ip/pool/add', [
        '=name=hs-pool-1',
        '=ranges=10.5.50.2-10.5.50.254',
      ]);

      // Set up DHCP server
      await this.connection.write('/ip/dhcp-server/add', [
        '=name=dhcp1',
        '=interface=bridge1',
        '=address-pool=hs-pool-1',
        '=lease-time=1h',
      ]);

      // Create hotspot profile
      await this.connection.write('/ip/hotspot/profile/add', [
        '=name=hsprof1',
        '=hotspot-address=10.5.50.1',
        '=dns-name=hotspot.spiderlan.net',
        '=html-directory=hotspot',
        '=login-by=cookie,http-chap,http-pap,mac-cookie',
      ]);

      // Enable hotspot on the bridge interface
      await this.connection.write('/ip/hotspot/add', [
        '=name=SPIDERLAN',
        '=interface=bridge1',
        '=address-pool=hs-pool-1',
        '=profile=hsprof1',
        '=addresses-per-mac=2',
      ]);

      console.log('Hotspot configurations set up successfully');
    } catch (error) {
      console.error('Failed to set up hotspot configurations:', error);
      throw error;
    }
  }
}

export default RouterManager;
