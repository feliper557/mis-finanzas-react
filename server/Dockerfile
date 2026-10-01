# Imagen minima: el VPS tiene 1 vCPU y 4 GB compartidos con otra aplicacion, asi que cada
# megabyte y cada segundo de arranque cuentan.
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /source

# Los archivos de proyecto van primero para aprovechar la cache de capas al restaurar.
COPY Directory.Build.props Directory.Packages.props ./
COPY src/MisFinanzas.Api/*.csproj src/MisFinanzas.Api/
RUN dotnet restore src/MisFinanzas.Api/MisFinanzas.Api.csproj

COPY src/ src/
RUN dotnet publish src/MisFinanzas.Api/MisFinanzas.Api.csproj \
    -c Release \
    -o /app \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# icu-libs y tzdata: sin ellos no se resuelven las zonas horarias IANA como America/Bogota.
# krb5-libs: Npgsql carga GSSAPI al abrir la conexion y sin esa libreria falla en Alpine.
RUN apk add --no-cache icu-libs tzdata krb5-libs \
    && adduser --disabled-password --no-create-home --uid 64199 misfinanzas
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    ASPNETCORE_HTTP_PORTS=8080 \
    # GC de estacion de trabajo: con el de servidor, el recolector veria los 4 GB libres del
    # VPS y creceria hasta que el kernel matara a PostgreSQL, que es quien mas memoria retiene.
    DOTNET_gcServer=0

COPY --from=build /app ./
USER misfinanzas
EXPOSE 8080

ENTRYPOINT ["dotnet", "MisFinanzas.Api.dll"]
