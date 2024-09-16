import { Request } from 'express';
import { exec } from 'child_process';

export const getIpAddress = (req: Request): string => {
    return req.ip || '0.0.0.0';
};

export const getMacAddress = (ipAddress: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        exec(`arp -n ${ipAddress}`, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            const macAddress = stdout.split('\n')[1]?.split(' ')[3];
            if (macAddress) {
                resolve(macAddress);
            } else {
                reject(new Error('MAC address not found'));
            }
        });
    });
};