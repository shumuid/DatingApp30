FROM mcr.microsoft.com/dotnet/core/aspnet:3.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/core/sdk:3.0 AS build
WORKDIR /src
COPY ["DatingApp.API.csproj", "./"]
RUN dotnet restore "DatingApp.API.csproj"
COPY . .
RUN dotnet build "DatingApp.API.csproj" -c Release -o /app

FROM build AS publish
RUN dotnet publish "DatingApp.API.csproj" -c Release -o /app

FROM base AS final
WORKDIR /app
COPY --from=publish /app .
ENTRYPOINT ["dotnet", "DatingApp.API.dll"]
