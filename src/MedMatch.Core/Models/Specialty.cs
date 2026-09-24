namespace MedMatch.Core.Models;

public class Specialty
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public SpecialtyCategory Category { get; set; }
    public bool IsActive { get; set; } = true;
}

public enum SpecialtyCategory
{
    InternalMedicine = 1,
    Surgery = 2,
    Pediatrics = 3,
    ObstetricsGynecology = 4,
    Emergency = 5,
    Cardiology = 6,
    Neurology = 7,
    Orthopedics = 8,
    Dermatology = 9,
    Psychiatry = 10,
    Radiology = 11,
    Anesthesiology = 12,
    Pathology = 13,
    Oncology = 14,
    Pulmonology = 15,
    Nephrology = 16,
    Gastroenterology = 17,
    Endocrinology = 18,
    Other = 99
}