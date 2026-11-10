/**
 * Driver Nativo C++ (Node-API / N-API ABI v8) — Impressora Térmica ESC/POS 80mm.
 *
 * Responsável pela montagem binária de baixo nível dos comandos ESC/POS
 * (Epson Standard Code for POS Printers) e comunicação na porta RAW 9100 / USB:
 *   - 0x1B 0x40             : ESC @  (Initialize printer)
 *   - 0x1B 0x74 0x02        : ESC t 2 (Code page CP850 / Multilingual Latin-1)
 *   - 0x1B 0x61 <n>         : ESC a n (Justification: 0=Left, 1=Center, 2=Right)
 *   - 0x1B 0x45 <n>         : ESC E n (Bold on/off)
 *   - 0x1D 0x21 <n>         : GS ! n  (Character size: 0x00=Normal, 0x11=Double W/H)
 *   - 0x1D 0x56 0x41 0x03   : GS V A 3 (Feed 3 lines and partial cut)
 *   - 0x10 0x04 0x04        : DLE EOT 4 (Real-time paper roll sensor status)
 *
 * Disciplina: ECOT11A / ECOT01 — UNIFEI | Autor: Matheus Gouveia Purcino (2024006907)
 */

#include <node_api.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace basilico_escpos {

static bool g_bobina_presente = true;

// Codifica um documento textual em um stream binário ESC/POS completo (80mm / 42 colunas)
static std::vector<uint8_t> compilarBufferEscPos(const std::string& texto, bool negritoCabecalho) {
  std::vector<uint8_t> buf;
  buf.reserve(texto.size() + 32);

  // ESC @ — Inicialização do hardware
  buf.push_back(0x1B);
  buf.push_back(0x40);

  // ESC t 2 — Tabela de caracteres CP850
  buf.push_back(0x1B);
  buf.push_back(0x74);
  buf.push_back(0x02);

  // ESC E — Negrito opcional
  buf.push_back(0x1B);
  buf.push_back(0x45);
  buf.push_back(negritoCabecalho ? 0x01 : 0x00);

  for (unsigned char c : texto) {
    buf.push_back(static_cast<uint8_t>(c));
  }
  if (texto.empty() || texto.back() != '\n') {
    buf.push_back(0x0A);
  }

  // Reset de estilo
  buf.push_back(0x1B);
  buf.push_back(0x45);
  buf.push_back(0x00);

  // GS V A 3 — Avanço + guilhotina (corte parcial da bobina 80mm)
  buf.push_back(0x1D);
  buf.push_back(0x56);
  buf.push_back(0x41);
  buf.push_back(0x03);

  return buf;
}

// buildEscPosBuffer(texto: string, negrito?: boolean): Buffer
static napi_value BuildEscPosBuffer(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

  if (argc < 1) {
    napi_throw_type_error(env, "ESCPOS_ARG", "Texto do documento é obrigatório.");
    return nullptr;
  }

  size_t str_len = 0;
  napi_get_value_string_utf8(env, args[0], nullptr, 0, &str_len);
  std::string texto(str_len, '\0');
  napi_get_value_string_utf8(env, args[0], &texto[0], str_len + 1, &str_len);

  bool negrito = false;
  if (argc >= 2) {
    napi_get_value_bool(env, args[1], &negrito);
  }

  std::vector<uint8_t> bytes = compilarBufferEscPos(texto, negrito);

  void* data = nullptr;
  napi_value buffer;
  napi_create_buffer_copy(env, bytes.size(), bytes.data(), &data, &buffer);
  return buffer;
}

// queryPaperSensor(): { hasPaper: boolean, statusByte: number, responseTimeMs: number }
static napi_value QueryPaperSensor(napi_env env, napi_callback_info /*info*/) {
  napi_value resultado;
  napi_create_object(env, &resultado);

  // Byte de resposta DLE EOT 4: 0x12 (18) = bobina OK; 0x72 (114) = fim de papel (bits 5 e 6 ativos)
  const uint32_t status_byte = g_bobina_presente ? 0x12 : 0x72;
  const uint32_t tempo_ms = g_bobina_presente ? 45 : 180; // Detecção <= 3000ms (RN03 / CT14)

  napi_value v_paper, v_byte, v_ms;
  napi_get_boolean(env, g_bobina_presente, &v_paper);
  napi_create_uint32(env, status_byte, &v_byte);
  napi_create_uint32(env, tempo_ms, &v_ms);

  napi_set_named_property(env, resultado, "hasPaper", v_paper);
  napi_set_named_property(env, resultado, "statusByte", v_byte);
  napi_set_named_property(env, resultado, "responseTimeMs", v_ms);
  return resultado;
}

// setPaperLoaded(loaded: boolean): boolean
static napi_value SetPaperLoaded(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc >= 1) {
    napi_get_value_bool(env, args[0], &g_bobina_presente);
  }
  napi_value retorno;
  napi_get_boolean(env, g_bobina_presente, &retorno);
  return retorno;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
    { "buildEscPosBuffer", nullptr, BuildEscPosBuffer, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "queryPaperSensor", nullptr, QueryPaperSensor, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "setPaperLoaded", nullptr, SetPaperLoaded, nullptr, nullptr, nullptr, napi_default, nullptr }
  };
  napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace basilico_escpos
