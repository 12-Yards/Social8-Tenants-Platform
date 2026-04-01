import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const NGINX_SITES_AVAILABLE_DIR = "/etc/nginx/sites-available";
const NGINX_SITES_ENABLED_DIR = "/etc/nginx/sites-enabled";

function buildTenantServerBlock(domainName: string, isSSL: boolean): string {
    const port = process.env.PORT || "5007";
    const backendPort = process.env.BACKEND_PORT || "5008";

    const baseDomain = domainName.replace(/^www\./, "");

    if (!isSSL) {
        return `
server {
    listen 80;
    listen [::]:80;

    server_name ${baseDomain} www.${baseDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${port};
        include proxy_params_node;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${backendPort};
        include proxy_params_node;
    }
}
`;
    }

    return `
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;

    server_name ${baseDomain} www.${baseDomain};

    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name ${baseDomain} www.${baseDomain};

    ssl_certificate /etc/letsencrypt/live/${baseDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${baseDomain}/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${port};
        include proxy_params_node;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${backendPort};
        include proxy_params_node;
    }
}
`;
}

function getExecErrorMessage(error: unknown): string {
    const err = error as { stderr?: Buffer; message?: string };

    if (err?.stderr) {
        const stderr = err.stderr.toString().trim();
        if (stderr) return stderr;
    }

    return err?.message || "Unknown command error";
}

export function ensureTenantNginxConfig(domainName: string, isSSL: boolean, nginxRefresh: boolean): void {

    const trimmedDomain = domainName.trim().toLowerCase();
    if (!trimmedDomain) return;

    if (!fs.existsSync(NGINX_SITES_AVAILABLE_DIR) || !fs.existsSync(NGINX_SITES_ENABLED_DIR)) {
        throw new Error("NGINX directories missing");
    }

    const baseDomain = trimmedDomain.replace(/^www\./, "");
    const domainRegex = /^[a-z0-9.-]+$/;

    if (!domainRegex.test(baseDomain)) {
        throw new Error("Invalid domain name");
    }

    const configFile = path.join(NGINX_SITES_AVAILABLE_DIR, `${baseDomain}.conf`);
    const symlinkFile = path.join(NGINX_SITES_ENABLED_DIR, `${baseDomain}.conf`);

    const config = buildTenantServerBlock(baseDomain, isSSL);

    fs.writeFileSync(configFile, config, "utf8");

    if (!fs.existsSync(symlinkFile)) {
        fs.symlinkSync(configFile, symlinkFile);
    }

    if (nginxRefresh) {
        try {
            execSync("sudo nginx -t", { stdio: "pipe" });
        } catch (error) {
            throw new Error(`nginx -t failed: ${getExecErrorMessage(error)}`);
        }

        try {
            execSync("sudo systemctl reload nginx", { stdio: "pipe" });
        } catch (error) {
            throw new Error(`nginx reload failed: ${getExecErrorMessage(error)}`);
        }
    }
}
