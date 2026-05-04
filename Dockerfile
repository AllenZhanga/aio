FROM eclipse-temurin:17-jre
WORKDIR /app
COPY apps/web/dist /app/web-dist
COPY apps/server/target/aio-server-*.jar /app/aio.jar
ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=classpath:/static/,file:/app/web-dist/
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/aio.jar"]
