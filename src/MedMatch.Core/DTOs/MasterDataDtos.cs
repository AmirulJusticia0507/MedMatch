namespace MedMatch.Core.DTOs;

public class SatuSehatFacilityDto
{
    public string KodeSatusehat { get; set; } = string.Empty;
    public string KodeSarana { get; set; } = string.Empty;
    public string Nama { get; set; } = string.Empty;
    public string Telepon { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool Operasional { get; set; }
    public string Alamat { get; set; } = string.Empty;
    public string KodeProvinsi { get; set; } = string.Empty;
    public string NamaProvinsi { get; set; } = string.Empty;
    public string KodeKabkota { get; set; } = string.Empty;
    public string NamaKabkota { get; set; } = string.Empty;
    public string KodeJenisSarana { get; set; } = string.Empty;
    public string NamaJenisSarana { get; set; } = string.Empty;
    public string KodeSubjenis { get; set; } = string.Empty;
    public string NamaSubjenis { get; set; } = string.Empty;
    public string KodeKelasSarana { get; set; } = string.Empty;
    public string NamaKelasSarana { get; set; } = string.Empty;
    public string StatusSarana { get; set; } = string.Empty;
    public bool StatusAktif { get; set; }
}
