using System.Net;
using System.Net.Http.Json;
using MisFinanzas.Api.Data;
using Shouldly;
using Xunit;

namespace MisFinanzas.Api.IntegrationTests;

/// <summary>
/// Comportamientos que la migracion tenia que arreglar o no romper. En particular el conflicto
/// de revision, que con Firestore ni se detectaba: ganaba el ultimo en escribir y el otro
/// dispositivo perdia sus datos en silencio.
/// </summary>
public sealed class DataEndpointsTests(ApiFactory fabrica) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Primer_acceso_siembra_el_documento_inicial()
    {
        var cliente = Autenticado("alta-" + Guid.NewGuid().ToString("N"));

        var blob = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        blob.ShouldNotBeNull();
        blob.V.ShouldBe(3);
        blob.Rev.ShouldBe(0);
        blob.Months.Count.ShouldBe(1);
        blob.Cats.ShouldContain(c => c.Id == "fijos");
        blob.SavingPots.ShouldContain(p => p.Id == "sp_default");
        blob.InvCats.ShouldContain(c => c.Id == "inv");
    }

    [Fact]
    public async Task Guardar_y_releer_devuelve_el_mismo_documento()
    {
        var cliente = Autenticado("ida-vuelta-" + Guid.NewGuid().ToString("N"));
        var inicial = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        var propuesto = inicial! with
        {
            Tx =
            [
                new TxBlob { Id = "t1", K = inicial.Months[0].K, Cat = "fijos", C = "Mercado", M = 120_000m, Pagado = true, D = "2026-09-15" },

                // Sin fecha: 33 de las 229 transacciones reales estan asi.
                new TxBlob { Id = "t2", K = inicial.Months[0].K, Cat = "fijos", C = "Taxi", M = 15_500m, Pagado = false },
            ],
            SavingEntries =
            [
                new SavingEntryBlob { Id = "s1", PotId = "sp_default", Nota = "Ahorro", M = 300_000m, D = "2026-09-01" },

                // Importe negativo: asi registra los retiros el cliente.
                new SavingEntryBlob { Id = "s2", PotId = "sp_default", Nota = "Retiro", M = -50_000m },
            ],
        };

        (await cliente.PutAsJsonAsync("/api/data", propuesto)).EnsureSuccessStatusCode();

        var leido = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        leido!.Rev.ShouldBe(1);
        leido.Tx.Select(t => t.Id).ShouldBe(["t1", "t2"]);
        leido.Tx[0].M.ShouldBe(120_000m);
        leido.Tx[1].D.ShouldBeNull();
        leido.SavingEntries[1].M.ShouldBe(-50_000m);
    }

    [Fact]
    public async Task El_orden_de_los_arrays_se_conserva_aunque_no_siga_al_identificador()
    {
        // Reproduce el caso real: los invItems del usuario principal llegan como 11, 9, 1, 2...
        var cliente = Autenticado("orden-" + Guid.NewGuid().ToString("N"));
        var inicial = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        string[] orden = ["11", "9", "1", "2"];
        var propuesto = inicial! with
        {
            InvItems = [.. orden.Select(id => new InvItemBlob
            {
                Id = id, Cat = "inv", C = $"Item {id}", M = 1000m, Pend = false,
            })],
        };

        (await cliente.PutAsJsonAsync("/api/data", propuesto)).EnsureSuccessStatusCode();

        var leido = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");
        leido!.InvItems.Select(i => i.Id).ShouldBe(orden);
    }

    [Fact]
    public async Task Una_revision_desfasada_se_rechaza_en_vez_de_pisar_los_datos()
    {
        var uid = "conflicto-" + Guid.NewGuid().ToString("N");
        var cliente = Autenticado(uid);
        var inicial = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        // Primer dispositivo: guarda correctamente y la revision avanza a 1.
        var primero = inicial! with { Cats = [.. inicial.Cats, Categoria("uno", "Desde el movil")] };
        (await cliente.PutAsJsonAsync("/api/data", primero)).EnsureSuccessStatusCode();

        // Segundo dispositivo: sigue con la revision 0 porque cargo antes.
        var segundo = inicial with { Cats = [.. inicial.Cats, Categoria("dos", "Desde el portatil")] };
        var respuesta = await cliente.PutAsJsonAsync("/api/data", segundo);

        respuesta.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var problema = await respuesta.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        problema!["code"].ToString().ShouldBe("revision_conflict");

        // Y lo importante: el trabajo del primer dispositivo sigue intacto.
        var leido = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");
        leido!.Cats.ShouldContain(c => c.Id == "uno");
        leido.Cats.ShouldNotContain(c => c.Id == "dos");
    }

    [Fact]
    public async Task Una_referencia_rota_se_rechaza_con_un_mensaje_util()
    {
        var cliente = Autenticado("referencia-" + Guid.NewGuid().ToString("N"));
        var inicial = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        var propuesto = inicial! with
        {
            Tx = [new TxBlob { Id = "x", K = inicial.Months[0].K, Cat = "categoria-que-no-existe", C = "Algo", M = 1m, Pagado = false }],
        };

        var respuesta = await cliente.PutAsJsonAsync("/api/data", propuesto);

        respuesta.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problema = await respuesta.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        problema!["code"].ToString().ShouldBe("documento_invalido");
        problema["detail"].ToString()!.ShouldContain("categoria-que-no-existe");
    }

    [Fact]
    public async Task Un_identificador_repetido_se_rechaza()
    {
        var cliente = Autenticado("repetido-" + Guid.NewGuid().ToString("N"));
        var inicial = await cliente.GetFromJsonAsync<FinanzasBlob>("/api/data");

        var propuesto = inicial! with
        {
            Tx =
            [
                new TxBlob { Id = "igual", K = inicial.Months[0].K, Cat = "fijos", C = "A", M = 1m, Pagado = false },
                new TxBlob { Id = "igual", K = inicial.Months[0].K, Cat = "fijos", C = "B", M = 2m, Pagado = false },
            ],
        };

        var respuesta = await cliente.PutAsJsonAsync("/api/data", propuesto);
        respuesta.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Cada_cuenta_solo_ve_sus_propios_datos()
    {
        var uidA = "aislado-a-" + Guid.NewGuid().ToString("N");
        var uidB = "aislado-b-" + Guid.NewGuid().ToString("N");

        var clienteA = Autenticado(uidA);
        var inicialA = await clienteA.GetFromJsonAsync<FinanzasBlob>("/api/data");
        var conDatos = inicialA! with { Cats = [.. inicialA.Cats, Categoria("solo-de-a", "Privada de A")] };
        (await clienteA.PutAsJsonAsync("/api/data", conDatos)).EnsureSuccessStatusCode();

        var clienteB = Autenticado(uidB);
        var deB = await clienteB.GetFromJsonAsync<FinanzasBlob>("/api/data");

        deB!.Cats.ShouldNotContain(c => c.Id == "solo-de-a");
        deB.Rev.ShouldBe(0);
    }

    [Fact]
    public async Task Sin_token_no_se_devuelve_nada()
    {
        var anonimo = fabrica.CreateClient();

        var respuesta = await anonimo.GetAsync(new Uri("/api/data", UriKind.Relative));

        respuesta.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Health_responde_sin_autenticacion()
    {
        var anonimo = fabrica.CreateClient();

        var respuesta = await anonimo.GetAsync(new Uri("/health", UriKind.Relative));

        respuesta.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await respuesta.Content.ReadAsStringAsync()).ShouldBe("Healthy");
    }

    private static CategoryBlob Categoria(string id, string nombre) =>
        new() { Id = id, Name = nombre, Group = "fijos" };

    private HttpClient Autenticado(string uid) => fabrica.ClienteDe(uid);
}
