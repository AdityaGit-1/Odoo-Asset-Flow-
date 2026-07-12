package com.example.assetflowlogin.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Enumeration;
import java.util.Set;

/**
 * Stands in for a real gateway until one is built. Everything under
 * /reports/** on this app's own port gets forwarded verbatim to the FastAPI
 * reports-service and the response streamed back — so from the browser's
 * point of view, reports live on the same origin as /api and /auth. No
 * CORS entry needed for /reports/** because of this: the browser only ever
 * talks to this backend, never to reports-service directly.
 *
 * Swap this out for Spring Cloud Gateway / nginx / whatever later without
 * the frontend or reports-service noticing — the contract (same-origin
 * /reports/** path) stays identical.
 */
@Configuration
public class ReportsProxyConfig {

    @Value("${reports.service.base-url:http://localhost:8000}")
    private String reportsServiceBaseUrl;

    @Bean
    public FilterRegistrationBean<Filter> reportsProxyFilter() {
        FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new ReportsProxyFilter(reportsServiceBaseUrl));
        registration.addUrlPatterns("/reports/*");
        registration.setOrder(1);
        return registration;
    }

    static class ReportsProxyFilter implements Filter {

        private static final Set<String> HOP_BY_HOP_REQUEST_HEADERS = Set.of(
                "host", "content-length", "connection", "transfer-encoding");
        private static final Set<String> HOP_BY_HOP_RESPONSE_HEADERS = Set.of(
                "transfer-encoding", "connection");

        private final String baseUrl;
        private final HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();

        ReportsProxyFilter(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        @Override
        public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain chain)
                throws IOException, ServletException {
            HttpServletRequest req = (HttpServletRequest) servletRequest;
            HttpServletResponse res = (HttpServletResponse) servletResponse;

            String query = req.getQueryString();
            String targetUrl = baseUrl + req.getRequestURI() + (query != null ? "?" + query : "");

            byte[] body = req.getInputStream().readAllBytes();

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .timeout(Duration.ofSeconds(30));

            Enumeration<String> headerNames = req.getHeaderNames();
            while (headerNames != null && headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                if (HOP_BY_HOP_REQUEST_HEADERS.contains(name.toLowerCase())) continue;
                Enumeration<String> values = req.getHeaders(name);
                while (values.hasMoreElements()) {
                    builder.header(name, values.nextElement());
                }
            }

            String method = req.getMethod();
            HttpRequest.BodyPublisher publisher = body.length > 0
                    ? HttpRequest.BodyPublishers.ofByteArray(body)
                    : HttpRequest.BodyPublishers.noBody();
            builder.method(method, publisher);

            HttpResponse<byte[]> upstreamResponse;
            try {
                upstreamResponse = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                res.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Reports service unreachable");
                return;
            } catch (IOException e) {
                res.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Reports service unreachable: " + e.getMessage());
                return;
            }

            res.setStatus(upstreamResponse.statusCode());
            upstreamResponse.headers().map().forEach((name, values) -> {
                if (HOP_BY_HOP_RESPONSE_HEADERS.contains(name.toLowerCase())) return;
                values.forEach(v -> res.addHeader(name, v));
            });
            res.getOutputStream().write(upstreamResponse.body());
            res.getOutputStream().flush();
        }
    }
}
