FROM node:22-alpine AS web-build
WORKDIR /workspace/apps/web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm install
COPY apps/web ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-17 AS server-build
WORKDIR /workspace
COPY pom.xml ./
COPY apps/server/pom.xml apps/server/pom.xml
RUN mvn -pl apps/server -am dependency:go-offline
COPY apps/server apps/server
COPY --from=web-build /workspace/apps/web/dist apps/server/src/main/resources/static
RUN mvn -pl apps/server -am package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=server-build /workspace/apps/server/target/aio-server-*.jar /app/aio.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/aio.jar"]
