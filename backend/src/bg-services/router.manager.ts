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

        // Remove ether1 from any bridge or switch configuration
        console.log('Removing ether1 from any bridge or switch configuration...');
        const bridgePorts = await this.connection.write('/interface/bridge/port/print');
        const ether1Port = bridgePorts.find(port => port.interface === 'ether1');

        if (ether1Port) {
            await this.connection.write('/interface/bridge/port/remove', [
                `=.id=${ether1Port['.id']}`,
            ]);
            console.log('ether1 is no longer a slave interface.');
        } else {
            console.log('ether1 is not part of any bridge or switch configuration.');
        }

        // Check and remove existing DHCP client on ether1
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

        // Create a bridge for the hotspot
        console.log('Creating bridge...');
        await this.connection.write('/interface/bridge/add', [
            '=name=bridge1',
        ]);

        // Refresh bridgePorts after creating the bridge
        const updatedBridgePorts = await this.connection.write('/interface/bridge/port/print');

        // Add ethernet interfaces (except ether1) to the bridge
        console.log('Adding interfaces to bridge...');
        for (const ethInterface of ethInterfaces) {
            if (ethInterface.name !== 'ether1') {
                const existingPort = updatedBridgePorts.find(port => port.interface === ethInterface.name && port.bridge === 'bridge1');
                const isAlreadyInBridge = !!existingPort;

                if (!isAlreadyInBridge) {
                    try {
                        await this.connection.write('/interface/bridge/port/add', [
                            '=bridge=bridge1',
                            `=interface=${ethInterface.name}`,
                        ]);
                        console.log(`Added ${ethInterface.name} to bridge1`);
                    } catch (error) {
                        console.error(`Failed to add ${ethInterface.name} to bridge1:`, error);
                        // Retry logic or alternative action can be added here
                    }
                } else {
                    console.log(`${ethInterface.name} is already part of bridge1`);
                }
            }
        }

        // Set up IP address for the hotspot
        console.log('Setting up IP address for hotspot...');
        try {
            await this.connection.write('/ip/address/add', [
                '=address=192.168.100.1/24',
                '=interface=bridge1',
            ]);
            console.log('IP address set up for hotspot');
        } catch (error) {
            console.error('Failed to set up IP address for hotspot:', error);
            // Retry logic or alternative action can be added here
        }

        // Create IP pool for hotspot clients
        console.log('Creating IP pool for hotspot clients...');
        try {
            await this.connection.write('/ip/pool/add', [
                '=name=hs-pool-1',
                '=ranges=192.168.100.2-192.168.100.254',
            ]);
            console.log('IP pool created for hotspot clients');
        } catch (error) {
            console.error('Failed to create IP pool for hotspot clients:', error);
            // Retry logic or alternative action can be added here
        }

        // Set up DHCP server
        console.log('Setting up DHCP server...');
        try {
            await this.connection.write('/ip/dhcp-server/add', [
                '=name=dhcp1',
                '=interface=bridge1',
                '=address-pool=hs-pool-1',
                '=lease-time=1h',
                '=disabled=no',
            ]);
            console.log('DHCP server set up');
        } catch (error) {
            console.error('Failed to set up DHCP server:', error);
            // Retry logic or alternative action can be added here
        }

        // Set up DHCP network with DNS servers
        console.log('Setting up DHCP network...');
        try {
            await this.connection.write('/ip/dhcp-server/network/add', [
                '=address=192.168.100.0/24',
                '=gateway=192.168.100.1',
                '=dns-server=8.8.8.8,8.8.4.4',
            ]);
            console.log('DHCP network set up');
        } catch (error) {
            console.error('Failed to set up DHCP network:', error);
            // Retry logic or alternative action can be added here
        }

        // Create hotspot profile
        console.log('Creating hotspot profile...');
        try {
            await this.connection.write('/ip/hotspot/profile/add', [
                '=name=hsprof1',
                '=hotspot-address=192.168.100.1',
                '=dns-name=hotspot.spiderlan.net',
                '=html-directory=hotspot',
                '=login-by=https',
                `=https-redirect=yes`,

            ]);
            console.log('Hotspot profile created');
        } catch (error) {
            console.error('Failed to create hotspot profile:', error);
            // Retry logic or alternative action can be added here
        }
        // Configure walled garden
        console.log('Configuring walled garden...');
        await this.connection.write('/ip/hotspot/walled-garden/ip/add', [
            '=dst-host=stxtuning.co.uk',
            '=action=accept',
        ]);
        await this.connection.write('/ip/hotspot/walled-garden/ip/add', [
            '=dst-host=stxtuning.co.uk/pop-and-bang-remap',
            '=action=accept',
        ]);
        console.log('Walled garden configured');


        // Enable hotspot on the bridge interface
        console.log('Enabling hotspot on bridge interface...');
        try {
            await this.connection.write('/ip/hotspot/add', [
                '=name=SPIDERLAN',
                '=interface=bridge1',
                '=address-pool=hs-pool-1',
                '=profile=hsprof1',
                '=addresses-per-mac=2',
            ]);
            console.log('Hotspot enabled on bridge interface');
        } catch (error) {
            console.error('Failed to enable hotspot on bridge interface:', error);
            // Retry logic or alternative action can be added here
        }

        // Enable the hotspot
        console.log('Enabling the hotspot...');
        try {
            await this.connection.write('/ip/hotspot/enable', [
                '=numbers=SPIDERLAN',
            ]);
            console.log('Hotspot enabled');
        } catch (error) {
            console.error('Failed to enable the hotspot:', error);
            // Retry logic or alternative action can be added here
        }

        // Update user profile
        console.log('Updating user profile...');
        try {
            await this.connection.write('/ip/hotspot/user/profile/set', [
                '=numbers=default',
                '=shared-users=20',
                '=session-timeout=1h',
                '=idle-timeout=10m',
                '=keepalive-timeout=2m',
            ]);
            console.log('User profile updated');
        } catch (error) {
            console.error('Failed to update user profile:', error);
            // Retry logic or alternative action can be added here
        }


        // Configure wireless interface if available
        console.log('Configuring wireless interface...');
        const wirelessInterfaces = await this.connection.write('/interface/wireless/print');
        const wlan1 = wirelessInterfaces.find(iface => iface.name === 'wlan1');

        if (wlan1) {
            // Disable CAPsMAN management for wlan1
            console.log('Disabling CAPsMAN management for wlan1...');
            try {
                await this.connection.write('/interface/wireless/cap/set', [
                    '=enabled=no',
                ]);
            } catch (error) {
                console.error('Failed to disable CAPsMAN management for wlan1:', error);
                // Retry logic or alternative action can be added here
            }

            // Configure the wireless interface
            try {
                await this.connection.write('/interface/wireless/set', [
                    `=numbers=${wlan1.name}`,
                    '=ssid=SPIDERLAN_HOTSPOT',
                    '=mode=ap-bridge',
                    '=disabled=no',
                ]);
            } catch (error) {
                console.error('Failed to configure the wireless interface:', error);
                // Retry logic or alternative action can be added here
            }

            // Add wireless interface to bridge
            try {
                await this.connection.write('/interface/bridge/port/add', [
                    '=bridge=bridge1',
                    `=interface=${wlan1.name}`,
                ]);
                console.log('Wireless interface configured and added to bridge');
            } catch (error) {
                console.error('Failed to add wireless interface to bridge:', error);
                // Retry logic or alternative action can be added here
            }
        } else {
            console.log('No wireless interface found, skipping wireless configuration');
        }

        // Add NAT rule for WAN
        console.log('Adding NAT rule for WAN...');
        try {
            await this.connection.write('/ip/firewall/nat/add', [
                '=chain=srcnat',
                '=action=masquerade',
                '=out-interface=ether1',
            ]);
            console.log('NAT rule added for WAN');
        } catch (error) {
            console.error('Failed to add NAT rule for WAN:', error);
            // Retry logic or alternative action can be added here
        }

        // Add firewall rules to allow DHCP traffic
        console.log('Adding firewall rules to allow DHCP traffic...');
        try {
            await this.connection.write('/ip/firewall/filter/add', [
                '=chain=input',
                '=protocol=udp',
                '=dst-port=67,68',
                '=action=accept',
            ]);
            await this.connection.write('/ip/firewall/filter/add', [
                '=chain=forward',
                '=protocol=udp',
                '=dst-port=67,68',
                '=action=accept',
            ]);
            console.log('Firewall rules added to allow DHCP traffic');
        } catch (error) {
            console.error('Failed to add firewall rules to allow DHCP traffic:', error);
            // Retry logic or alternative action can be added here
        }

        // Add firewall rules to allow traffic from hotspot to internet
        console.log('Adding firewall rules to allow traffic from hotspot to internet...');
        try {
            await this.connection.write('/ip/firewall/filter/add', [
                '=chain=forward',
                '=src-address=192.168.100.0/24',
                '=action=accept',
            ]);
            console.log('Firewall rules added to allow traffic from hotspot to internet');
        } catch (error) {
            console.error('Failed to add firewall rules to allow traffic from hotspot to internet:', error);
            // Retry logic or alternative action can be added here
        }
         // Configure DNS settings for the hotspot
         console.log('Configuring DNS settings for the hotspot...');
         await this.connection.write('/ip/dns/set', [
             '=allow-remote-requests=yes',
             '=servers=8.8.8.8,8.8.4.4',
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
        const fileName = path.basename(templatePath);
        const fileContent = fs.readFileSync(templatePath, 'utf8');

        // Remove existing file if it exists
        try {
            await this.connection.write('/file/remove', [
                `=numbers=hotspot/${fileName}`,
            ]);
            console.log('Existing file removed');
        } catch (removeError) {
            console.log('No existing file to remove, proceeding with upload');
        }

        // Check if the file exists
      const file = await this.connection.write('/file/print', [
        `?name=hotspot/${fileName}`,
      ]);

      if (file.length === 0) {
        // Create the file if it does not exist
        await this.connection.write(`/file/set/hotspot/${fileName}`, [
          `=contents=`,
        ]);
        console.log('File created');
      }

      // Upload the file content
      await this.connection.write(`/file/set/hotspot/${fileName}`, [
        `=contents=${fileContent}`,
      ]);
      console.log('Hotspot template uploaded successfully');

        // Add a delay before verifying the file
        await new Promise(resolve => setTimeout(resolve, 5000));

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
