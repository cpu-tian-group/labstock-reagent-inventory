export const categoryFilters = [
  '全部',
  '药物/抗生素',
  '天然产物',
  '氨基酸/缓冲液',
  '蛋白/酶',
  '染料/显色',
  '核酸/脂质',
  '有机合成',
  '危险化学品',
  '其他',
];

export function classifyReagent(name: string) {
  const value = name.toLowerCase();
  const matches = (keywords: string[]) =>
    keywords.some((keyword) => value.includes(keyword.toLowerCase()));

  if (
    matches([
      '蛋白',
      '胶原',
      '酶',
      'lap',
      'protein ladder',
      'dnase',
      'dna酶',
      'bsa',
    ])
  ) {
    return '蛋白/酶';
  }

  if (
    matches([
      'dna',
      'dspg',
      'dspe',
      '卵磷脂',
      '脑磷脂',
      '胆固醇',
      '脂多糖',
      'lps',
      'sphingosine',
      'mpeg',
      'peg',
      '磷脂',
    ])
  ) {
    return '核酸/脂质';
  }

  if (
    matches([
      '亚甲基蓝',
      'tmb',
      '四甲基联苯胺',
      'abts',
      'hoechst',
      '显色',
    ])
  ) {
    return '染料/显色';
  }

  if (
    matches([
      '半胱氨酸',
      '甲硫氨酸',
      '谷氨酰胺',
      '谷氨酸',
      '亮氨酸',
      '肌氨酸',
      'taunine',
      '牛磺酸',
      'nac(',
      'mes',
      'hepes',
      'tris',
      '缓冲',
    ])
  ) {
    return '氨基酸/缓冲液';
  }

  if (
    matches([
      'edc',
      'n-羟基琥珀酰亚胺',
      '碳二亚胺',
      '二硫苏糖醇',
      '戊二醛',
      '三氯乙酸',
      'aps',
      '金溶液',
      '丙酮酸',
      'tm3',
      '1 - ',
      '1-萘酚',
      '4-甲酰苯硼酸',
      'n-(3-氨基',
      'deta-no',
      '二亚乙基',
    ])
  ) {
    return '有机合成';
  }

  if (
    matches([
      '霉素',
      '头孢',
      '青霉素',
      '沙坦',
      '拉唑',
      '洛韦',
      '普利',
      '阿霉素',
      '利巴韦林',
      '环孢素',
      '异烟肼',
      '吡嗪酰胺',
      '地塞米松',
      '吲哚美辛',
      '双氯芬酸',
      '尼美舒利',
      '利福平',
      '多粘菌素',
      '班布特罗',
      '奥司他韦',
    ])
  ) {
    return '药物/抗生素';
  }

  if (
    matches([
      '苷',
      '黄酮',
      '芍药',
      '甘草',
      '藜芦',
      '姜',
      '儿茶素',
      '槲皮素',
      '白术',
      '防己',
      '光甘草',
      '原儿茶',
      '橙皮',
      '柚皮',
      '姜黄',
      '丹参',
      '苦参',
      '人参',
      '落新妇',
      '秋水仙',
      '喜树',
      '芦丁',
      '没食子',
      '虎杖',
      '川芎',
      '水飞蓟',
      '齐墩果',
      '厚朴',
      '吴茱萸',
      '马兜铃',
      '芒柄花',
      '虾青素',
    ])
  ) {
    return '天然产物';
  }

  return '其他';
}
