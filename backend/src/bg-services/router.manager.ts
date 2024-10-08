import { RouterOSAPI } from 'node-routeros';
import * as fs from 'fs';
import * as path from 'path';
import FTPClient from 'ftp';

class RouterManager {
  public connection: RouterOSAPI;

  constructor(host: string, username: string, password: string) {
    this.connection = new RouterOSAPI({
      host,
      user: username,
      password,
      timeout: 30000,
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
            `=login-page=${loginPage}`,
        ]);
        console.log('Hotspot redirect configured successfully');
    } catch (error: any) {
        console.error('Failed to configure hotspot redirect:', error);
        if (error.response && error.response.data) {
            console.error('Error details:', error.response.data);
        } else {
            console.error('Error details:', error.message);
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

  async setupHotspotConfigurations(ssid: string): Promise<void> {
    try {
      console.log('Starting hotspot configuration setup...');

      // List available interfaces
      const interfaces = await this.connection.write('/interface/print');
      console.log('Available interfaces:', interfaces);

      const ethInterfaces = interfaces.filter(iface => iface.name.startsWith('ether'));
      console.log('Ethernet interfaces:', ethInterfaces);

      if (ethInterfaces.length < 1) {
        throw new Error('At least one ethernet interface is required.');
      }

      // Remove ether1 from any bridge or switch configuration
      console.log('Removing ether1 from any bridge or switch configuration...');
      const bridgePorts = await this.connection.write('/interface/bridge/port/print');
      const ether1Port = bridgePorts.find(port => port.interface === 'ether1');

      if (ether1Port) {
        await this.connection.write('/interface/bridge/port/remove', [
          `=.id=${ether1Port['.id']}`,
        ]);
        console.log('ether1 is no longer a bridge port.');
      } else {
        console.log('ether1 is not part of any bridge or switch configuration.');
      }

      // Remove existing DHCP client on ether1
      console.log('Checking for existing DHCP client on ether1...');
      const dhcpClients = await this.connection.write('/ip/dhcp-client/print');
      const ether1DhcpClient = dhcpClients.find(client => client.interface === 'ether1');

      if (ether1DhcpClient) {
        await this.connection.write('/ip/dhcp-client/remove', [
          `=.id=${ether1DhcpClient['.id']}`,
        ]);
        console.log('Removed existing DHCP client on ether1.');
      }

      // Configure ether1 as WAN interface
      console.log('Configuring ether1 as WAN interface...');
      await this.connection.write('/ip/dhcp-client/add', [
        '=interface=ether1',
        '=disabled=no',
      ]);

      // Create a bridge for the hotspot if it doesn't exist
      console.log('Creating bridge...');
      const existingBridges = await this.connection.write('/interface/bridge/print', [
        '?name=bridge1',
      ]);

      if (existingBridges.length === 0) {
        await this.connection.write('/interface/bridge/add', [
          '=name=bridge1',
        ]);
        console.log('Bridge1 created.');
      } else {
        console.log('Bridge1 already exists.');
      }

      // Add ethernet interfaces (except ether1) to the bridge
      console.log('Adding interfaces to bridge...');
      const currentBridgePorts = await this.connection.write('/interface/bridge/port/print');

      for (const ethInterface of ethInterfaces) {
        if (ethInterface.name !== 'ether1') {
          const isAlreadyInBridge = currentBridgePorts.some(
            port => port.interface === ethInterface.name && port.bridge === 'bridge1'
          );

          if (!isAlreadyInBridge) {
            // Remove from any other bridge
            const existingPort = currentBridgePorts.find(port => port.interface === ethInterface.name);
            if (existingPort) {
              await this.connection.write('/interface/bridge/port/remove', [
                `=.id=${existingPort['.id']}`,
              ]);
              console.log(`Removed ${ethInterface.name} from existing bridge.`);
            }

            // Add to bridge1
            await this.connection.write('/interface/bridge/port/add', [
              '=bridge=bridge1',
              `=interface=${ethInterface.name}`,
            ]);
            console.log(`Added ${ethInterface.name} to bridge1.`);
          } else {
            console.log(`${ethInterface.name} is already part of bridge1.`);
          }
        }
      }

      // Set up IP address for the hotspot
      console.log('Setting up IP address for hotspot...');
      const ipAddresses = await this.connection.write('/ip/address/print');
      const hotspotIP = ipAddresses.find(addr => addr.address.startsWith('192.168.100.1/24') && addr.interface === 'bridge1');

      if (!hotspotIP) {
        await this.connection.write('/ip/address/add', [
          '=address=192.168.100.1/24',
          '=interface=bridge1',
        ]);
        console.log('IP address set up for hotspot');
      } else {
        console.log('IP address for hotspot already configured.');
      }

      // Create IP pool for hotspot clients
      console.log('Creating IP pool for hotspot clients...');
      const ipPools = await this.connection.write('/ip/pool/print');
      const hsPool = ipPools.find(pool => pool.name === 'hs-pool-1');

      if (!hsPool) {
        await this.connection.write('/ip/pool/add', [
          '=name=hs-pool-1',
          '=ranges=192.168.100.2-192.168.100.254',
        ]);
        console.log('IP pool created for hotspot clients');
      } else {
        console.log('IP pool for hotspot clients already exists.');
      }

      // Set up DHCP server
      console.log('Setting up DHCP server...');
      const dhcpServers = await this.connection.write('/ip/dhcp-server/print');
      const dhcp1 = dhcpServers.find(server => server.name === 'dhcp1');

      if (!dhcp1) {
        await this.connection.write('/ip/dhcp-server/add', [
          '=name=dhcp1',
          '=interface=bridge1',
          '=address-pool=hs-pool-1',
          '=lease-time=1h',
          '=disabled=no',
        ]);
        console.log('DHCP server set up');
      } else {
        console.log('DHCP server already exists.');
      }

      // Set up DHCP network with DNS servers
      console.log('Setting up DHCP network...');
      const dhcpNetworks = await this.connection.write('/ip/dhcp-server/network/print');
      const dhcpNetwork = dhcpNetworks.find(network => network.address === '192.168.100.0/24');

      if (!dhcpNetwork) {
        await this.connection.write('/ip/dhcp-server/network/add', [
          '=address=192.168.100.0/24',
          '=gateway=192.168.100.1',
          '=dns-server=8.8.8.8,8.8.4.4',
        ]);
        console.log('DHCP network set up');
      } else {
        console.log('DHCP network already configured.');
      }

      // Create hotspot profile
      console.log('Creating hotspot profile...');
      const hotspotProfiles = await this.connection.write('/ip/hotspot/profile/print');
      const hsprof1 = hotspotProfiles.find(profile => profile.name === 'hsprof1');

      if (!hsprof1) {
        await this.connection.write('/ip/hotspot/profile/add', [
          '=name=hsprof1',
          '=hotspot-address=192.168.100.1',
          '=dns-name=hotspot.local',
          '=html-directory=hotspot',
          '=login-by=http-chap,http-pap,cookie,mac-cookie',
          '=http-cookie-lifetime=1d',
        ]);
        console.log('Hotspot profile created');
      } else {
        console.log('Hotspot profile already exists.');
      }

      // Enable hotspot on the bridge interface
      console.log('Enabling hotspot on bridge interface...');
      const hotspots = await this.connection.write('/ip/hotspot/print');
      const hotspotExists = hotspots.find(hotspot => hotspot.name === 'SPIDERLAN');

      if (!hotspotExists) {
        await this.connection.write('/ip/hotspot/add', [
          '=name=SPIDERLAN',
          '=interface=bridge1',
          '=address-pool=hs-pool-1',
          '=profile=hsprof1',
          '=idle-timeout=5m',
          '=keepalive-timeout=none',
          '=addresses-per-mac=2',
        ]);
        console.log('Hotspot enabled on bridge interface');
      } else {
        console.log('Hotspot already enabled on bridge interface.');
      }

      // Update user profile
      console.log('Updating user profile...');
      await this.connection.write('/ip/hotspot/user/profile/set', [
        '=numbers=default',
        '=shared-users=1',
        '=session-timeout=1h',
        '=idle-timeout=10m',
        '=keepalive-timeout=2m',
      ]);
      console.log('User profile updated');

      // Configure wireless interface if available
      console.log('Configuring wireless interface...');
      const wirelessInterfaces = await this.connection.write('/interface/wireless/print');
      const wlan1 = wirelessInterfaces.find(iface => iface.name === 'wlan1');

      if (wlan1) {
        // Disable CAPsMAN management for wlan1
        console.log('Disabling CAPsMAN management for wlan1...');
        await this.connection.write('/interface/wireless/cap/set', [
          '=enabled=no',
        ]);

        // Configure the wireless interface
        await this.connection.write('/interface/wireless/set', [
          `=numbers=${wlan1.name}`,
          `=ssid=${ssid}`,
          '=mode=ap-bridge',
          '=disabled=no',
        ]);
        console.log('Wireless interface configured');

        // Check if wlan1 is already in a bridge
        const wlanBridgePort = currentBridgePorts.find(port => port.interface === 'wlan1');

        if (!wlanBridgePort) {
          // Add wireless interface to bridge
          await this.connection.write('/interface/bridge/port/add', [
            '=bridge=bridge1',
            `=interface=${wlan1.name}`,
          ]);
          console.log('Wireless interface added to bridge');
        } else if (wlanBridgePort.bridge !== 'bridge1') {
          // Remove from existing bridge and add to bridge1
          await this.connection.write('/interface/bridge/port/remove', [
            `=.id=${wlanBridgePort['.id']}`,
          ]);
          await this.connection.write('/interface/bridge/port/add', [
            '=bridge=bridge1',
            `=interface=${wlan1.name}`,
          ]);
          console.log('Wireless interface moved to bridge1');
        } else {
          console.log('Wireless interface already part of bridge1');
        }
      } else {
        console.log('No wireless interface found, skipping wireless configuration');
      }

      // Add NAT rule for WAN
      console.log('Adding NAT rule for WAN...');
      const natRules = await this.connection.write('/ip/firewall/nat/print');
      const natRuleExists = natRules.find(
        rule => rule.chain === 'srcnat' && rule.action === 'masquerade' && rule['out-interface'] === 'ether1'
      );

      if (!natRuleExists) {
        await this.connection.write('/ip/firewall/nat/add', [
          '=chain=srcnat',
          '=action=masquerade',
          '=out-interface=ether1',
        ]);
        console.log('NAT rule added for WAN');
      } else {
        console.log('NAT rule for WAN already exists.');
      }

      // Add firewall rules to allow DHCP traffic
      console.log('Adding firewall rules to allow DHCP traffic...');
      const firewallFilters = await this.connection.write('/ip/firewall/filter/print');
      const dhcpInputRule = firewallFilters.find(
        rule => rule.chain === 'input' && rule.protocol === 'udp' && rule['dst-port'] === '67,68'
      );
      const dhcpForwardRule = firewallFilters.find(
        rule => rule.chain === 'forward' && rule.protocol === 'udp' && rule['dst-port'] === '67,68'
      );

      if (!dhcpInputRule) {
        await this.connection.write('/ip/firewall/filter/add', [
          '=chain=input',
          '=protocol=udp',
          '=dst-port=67,68',
          '=action=accept',
        ]);
        console.log('DHCP input firewall rule added.');
      } else {
        console.log('DHCP input firewall rule already exists.');
      }

      if (!dhcpForwardRule) {
        await this.connection.write('/ip/firewall/filter/add', [
          '=chain=forward',
          '=protocol=udp',
          '=dst-port=67,68',
          '=action=accept',
        ]);
        console.log('DHCP forward firewall rule added.');
      } else {
        console.log('DHCP forward firewall rule already exists.');
      }

      // Add firewall rules to allow traffic from hotspot to internet
      console.log('Adding firewall rules to allow traffic from hotspot to internet...');
      const hotspotForwardRule = firewallFilters.find(
        rule => rule.chain === 'forward' && rule['src-address'] === '192.168.100.0/24' && rule.action === 'accept'
      );

      if (!hotspotForwardRule) {
        await this.connection.write('/ip/firewall/filter/add', [
          '=chain=forward',
          '=src-address=192.168.100.0/24',
          '=action=accept',
        ]);
        console.log('Firewall rule added to allow traffic from hotspot to internet');
      } else {
        console.log('Firewall rule for hotspot to internet already exists.');
      }

      // Configure DNS settings for the hotspot
      console.log('Configuring DNS settings for the hotspot...');
      await this.connection.write('/ip/dns/set', [
        '=allow-remote-requests=yes',
        '=servers=8.8.8.8,8.8.4.4',
      ]);
      console.log('DNS settings configured');

      // Set the html-directory and ensure it is 'hotspot'
      console.log('Configuring hotspot settings...');
      await this.connection.write('/ip/hotspot/profile/set', [
        '=numbers=hsprof1',
        '=html-directory=hotspot',
      ]);
      console.log('Hotspot profile html-directory set to "hotspot"');

      console.log('Hotspot configurations set up successfully');
    } catch (error: any) {
      console.error('Failed to set up hotspot configurations:', error);
      throw error;
    }
  }
  async configureHotspotSettings(ssid: string, loginPage: string): Promise<void> {
    try {
      console.log('Configuring hotspot settings...');
  
         // Configure hotspot profile
     await this.connection.write('/ip/hotspot/profile/set', [
      '=numbers=hsprof1',
      '=login-by=http-chap,http-pap,mac-cookie',
      '=html-directory=hotspot',
      `=login-page=${loginPage}`,
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

 
  async uploadHotspotTemplate(templateDir: string): Promise<void> {
    try {
      console.log('Uploading hotspot templates...');
      const files = fs.readdirSync(templateDir);

      // Use FTP to upload the files to the router
      const ftpClient = new FTPClient();
      ftpClient.on('ready', () => {
        files.forEach(file => {
          ftpClient.put(path.join(templateDir, file), `hotspot/${file}`, (err) => {
            if (err) throw err;
            console.log(`Uploaded ${file} to router`);
          });
        });
        ftpClient.end();
      });

      ftpClient.connect({
        host: this.connection.host,
        user: this.connection.user,
        password: this.connection.password,
        port: 21,
      });

      // Add a delay before verifying the files
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify the files were uploaded
      const uploadedFiles = await this.connection.write('/file/print');
      files.forEach(file => {
        const exists = uploadedFiles.some(f => f.name === `hotspot/${file}`);
        if (!exists) {
          throw new Error(`File ${file} upload failed`);
        }
      });

      console.log('All files verified in RouterOS');
    } catch (error: any) {
      console.error('Failed to upload hotspot templates:', error);
      throw error;
    }
  }

}
  

export default RouterManager;
