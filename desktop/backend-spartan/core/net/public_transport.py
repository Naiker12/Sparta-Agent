"""HTTPS transport that pins public DNS results for each outbound request."""
import asyncio
import ipaddress
import socket

import httpx


class PublicPinnedTransport(httpx.AsyncBaseTransport):
    """Connect to a verified global address while retaining the TLS hostname."""

    def __init__(self):
        self.inner = httpx.AsyncHTTPTransport(retries=0)

    async def handle_async_request(self, request):
        host = request.url.host
        port = request.url.port or 443
        if request.url.scheme != 'https' or port != 443:
            raise ValueError('invalid_public_endpoint')
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, host, port, 0, socket.SOCK_STREAM,
        )
        ips = [item[4][0] for item in addresses]
        if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
            raise ValueError('invalid_public_endpoint')
        request.extensions['sni_hostname'] = host
        request.url = request.url.copy_with(host=ips[0])
        return await self.inner.handle_async_request(request)

    async def aclose(self):
        await self.inner.aclose()
