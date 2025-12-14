/**
 * TMDB Proxy Worker for India ISP bypass (Jio/Airtel)
 * 
 * This worker proxies requests to TMDB API and Image CDN
 * to bypass ISP-level blocks in India.
 * 
 * Routes:
 *   /api/*  -> api.themoviedb.org/3/*
 *   /img/*  -> image.tmdb.org/t/p/*
 *   /       -> Health check
 */

export default {
	async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// CORS headers for all responses
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Route: /api/* -> api.themoviedb.org/3/*
			if (pathname.startsWith('/api/')) {
				const tmdbPath = pathname.replace('/api/', '');
				const targetUrl = `https://api.themoviedb.org/3/${tmdbPath}${url.search}`;

				const response = await fetch(targetUrl, {
					method: request.method,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						'Accept': 'application/json',
					},
				});

				const data = await response.text();
				return new Response(data, {
					status: response.status,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
					},
				});
			}

			// Route: /img/* -> image.tmdb.org/t/p/*
			if (pathname.startsWith('/img/')) {
				const imgPath = pathname.replace('/img/', '');
				const targetUrl = `https://image.tmdb.org/t/p/${imgPath}`;

				const response = await fetch(targetUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
				});

				if (!response.ok) {
					return new Response('Image not found', {
						status: response.status,
						headers: corsHeaders
					});
				}

				const imageData = await response.arrayBuffer();
				const contentType = response.headers.get('Content-Type') || 'image/jpeg';

				return new Response(imageData, {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=86400', // Cache images for 24 hours
					},
				});
			}

			// Health check / root
			if (pathname === '/' || pathname === '/health') {
				return new Response(JSON.stringify({
					status: 'ok',
					service: 'TMDB Proxy for SuperEmbed 4K',
					routes: {
						api: '/api/* -> api.themoviedb.org/3/*',
						images: '/img/* -> image.tmdb.org/t/p/*',
					},
					timestamp: new Date().toISOString(),
				}), {
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json',
					},
				});
			}

			// 404 for unknown routes
			return new Response(JSON.stringify({ error: 'Not Found', path: pathname }), {
				status: 404,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json',
				},
			});

		} catch (error) {
			return new Response(JSON.stringify({
				error: 'Proxy Error',
				message: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json',
				},
			});
		}
	},
} satisfies ExportedHandler;
